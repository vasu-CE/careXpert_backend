import { Response } from "express";
import { UserRequest } from "../utils/helper";
import { AppointmentStatus, PrismaClient, TimeSlotStatus } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

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
        start: appointment.timeSlot.startTime,
        end: appointment.timeSlot.endTime,
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

export { viewDoctorAppointment, updateAppointmentStatus };
