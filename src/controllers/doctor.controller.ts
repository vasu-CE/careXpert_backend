import { Response } from "express";
import { UserRequest } from "../utils/helper";
import { AppointmentStatus, PrismaClient, TimeSlotStatus } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { time } from "console";

const prisma = new PrismaClient();

const viewDoctorAppointment = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  const { status, upcoming } = req.query; // status=PENDING/COMPLETED/CANCELLED, upcoming=true

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });

  try {
    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const filters: any = {
      doctorId: doctor.id,
    };

    if (status && typeof status === "string") {
      filters.status = status as AppointmentStatus;
    }

    if (upcoming === "true") {
      filters.timeSlot = {
        startTime: {
          gte: new Date(),
        },
      };
    }
    
    const appointments = await prisma.appointment.findMany({
      where: filters,
      include: {
        patient: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        timeSlot: true,
      },
      orderBy: {
        timeSlot: {
          startTime: "asc",
        },
      },
    });

    const formattedAppointments = appointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      patientName: appointment.patient.user.name,
      notes: appointment.notes,
      appointmentTime: {
        startTime: appointment.timeSlot.startTime,
        endTime: appointment.timeSlot.endTime,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const updateAppointmentStatus = async (req: UserRequest, res: Response) => {
  const {id}=req.params;
  const {status,notes,prescriptionText}=req.body;

  if(!["COMPLETED","CANCELLED"].includes(status)){
    res.status(400).json(new ApiError(400,"Status must be Completed or Cancelled"));
    return;
  }
  try{
    const appointment = await prisma.appointment.findUnique({
      where:{id},
      include:{
        timeSlot:true,
        patient:true,
        doctor:true,
      }
    })
    if(!appointment){
        res.status(400).json(new ApiError(400,"Appointment not found!"));
        return;
    }
    const updatedAppointment = await prisma.appointment.update({
      where:{id},
      data:{
        status:status as AppointmentStatus,
        notes: notes||undefined
      },
    });
    if(status==="CANCELLED"){
      await prisma.timeSlot.update({
        where:{id:appointment.timeSlotId},
        data:{
          status:TimeSlotStatus.AVAILABLE
        },
      });
    }
    if(status==="COMPLETED"&&prescriptionText){
      await prisma.prescription.create({
        data:{
          doctorId:appointment.doctorId,
          patientId:appointment.patientId,
          prescriptionText:prescriptionText
        },
      });
    }
     res
      .status(200)
      .json(
        new ApiResponse(200, updatedAppointment, "Appointment updated successfully")
      );
  }
  catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to update appointment", [error]));
  }
};

const addTimeslot = async (req:UserRequest , res:Response) => {
  const {startTime , endTime} = req.body;
  if(!startTime || !endTime){
    res.status(400).json(new ApiError(400 , "Start and end time required"));
    return;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if(isNaN(start.getTime()) || isNaN(end.getTime())){
    res.status(400).json(new ApiError(400 , "Invalid date format"));
  }
  const totalTime = (end.getTime() - start.getTime()) / 1000 / 60 / 60;

  if(totalTime > 3 || totalTime < 0){
    res.status(400).json(new ApiResponse(400 , "Time slot must be between 0 to 3 hours"));
    return;
  }
  try {

    const userId = req.user?.id;
    const doctor = await prisma.doctor.findUnique({
      where : {userId},
      select : {id : true}
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const existingTimeslot = await prisma.timeSlot.findFirst({
      where : {
        doctorId : doctor.id,
        startTime : {lt : end},
        endTime : {gt : start}
      },
      select : {id : true}
    });

    if(existingTimeslot){
      res.status(400).json(new ApiError(400 , "Timeslot overlap with the existing timeslot"));
      return;
    }

    await prisma.$transaction(async (prisma) => {
      const timeSlot = await prisma.timeSlot.create({
        data : {
          doctorId : doctor.id,
          startTime,
          endTime,
        }
      });
      await prisma.doctor.update({
        where : {id : doctor.id},
        data : {
          timeSlots : {
            connect : {id : timeSlot.id}
          }
        }
      })
    })

    res.status(200).json(new ApiResponse(200, "Timeslot added suyuccessfully"));

  } catch (error) {
    res.status(500).json(new ApiError(500 , "Internal server error" , [error]));
  }
}

const viewTimeslots = async (req : UserRequest , res:Response) => {
  const {status , startTime , endTime} = req.query; //status = AVAILABLE,BOOKED,CANCELLED
  const userId = req.user?.id;

  try {
    const doctor = await prisma.doctor.findUnique({
      where : {userId}
    });
    if(!doctor){
      res.status(400).json(new ApiError(400 , "Doctor not found"));
      return;
    }

    const filters : any = {
      doctorId : doctor.id
    }
    if(status && typeof status === "string"){
      filters.status = status as TimeSlotStatus
    }
    if(startTime){
      filters.startTime = { gte : startTime}
    }
    if(endTime){
      filters.endTime = { lte : endTime}
    }
    const timeSlots = await prisma.timeSlot.findMany({
      where : filters,
      include : {
        appointment : {
          include : {
            patient : true
          }
        }
      },
      orderBy : {
        startTime : "asc"
      }
    });

    res.status(200).json(new ApiResponse(200 , timeSlots));
    return;
  } catch (error) {
    res.status(500).json(new ApiError(500 , "internal server error" , [error]));
  }

}

export { 
  viewDoctorAppointment,
  updateAppointmentStatus,
  addTimeslot,
  viewTimeslots
};
