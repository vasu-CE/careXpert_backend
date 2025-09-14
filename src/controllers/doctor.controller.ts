import { Response } from "express";
import { UserRequest } from "../utils/helper";
import {
  AppointmentStatus,
  PrismaClient,
  TimeSlotStatus,
  AppointmentType,
} from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { time } from "console";
import doc from "pdfkit";

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
                profilePicture : true
              },
            },
          },
        },
        timeSlot: true,
      },
      // orderBy: {
      //   timeSlot: {
      //     startTime: "asc",
      //   },
      // },
    });

    const formattedAppointments = appointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      patientName: appointment.patient.user.name,
      profilePicture : appointment.patient.user.profilePicture,
      notes: appointment.notes,
      appointmentTime: {
        startTime: appointment.timeSlot?.startTime,
        endTime: appointment.timeSlot?.endTime,
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
  const { id } = req.params;
  const { status, notes, prescriptionText } = req.body;

  if (!["COMPLETED", "CANCELLED"].includes(status)) {
    res
      .status(400)
      .json(new ApiError(400, "Status must be Completed or Cancelled"));
    return;
  }
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        timeSlot: true,
        patient: true,
        doctor: true,
      },
    });
    if (!appointment) {
      res.status(400).json(new ApiError(400, "Appointment not found!"));
      return;
    }
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: status as AppointmentStatus,
        notes: notes || undefined,
      },
    });
    if (status === "CANCELLED") {
      if (appointment.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: {
            status: TimeSlotStatus.AVAILABLE,
          },
        });
      }
    }
    if (status === "COMPLETED" && prescriptionText) {
      const prescription = await prisma.prescription.create({
        data: {
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          prescriptionText: prescriptionText,
        },
      });
      await prisma.patientHistory.create({
        data: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          prescriptionId: prescription.id,
          appointmentId: appointment.id,
          notes: notes || "",
          dateRecorded: new Date(),
        },
      });
    }
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedAppointment,
          "Appointment updated successfully"
        )
      );
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to update appointment", [error]));
  }
};

const addTimeslot = async (req: UserRequest, res: Response) => {
  const { startTime, endTime } = req.body;
  if (!startTime || !endTime) {
    res.status(400).json(new ApiError(400, "Start and end time required"));
    return;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json(new ApiError(400, "Invalid date format"));
    return;
  }
  const totalTime = (end.getTime() - start.getTime()) / 1000 / 60 / 60;

  if (totalTime > 3 || totalTime < 0) {
    res
      .status(400)
      .json(new ApiResponse(400, "Time slot must be between 0 to 3 hours"));
    return;
  }
  try {
    const userId = req.user?.id;
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "No doctor found!"));
      return;
    }

    const existingTimeslot = await prisma.timeSlot.findFirst({
      where: {
        doctorId: doctor.id,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    });

    if (existingTimeslot) {
      res
        .status(400)
        .json(new ApiError(400, "Timeslot overlap with the existing timeslot"));
      return;
    }

    await prisma.$transaction(async (prisma) => {
      const timeSlot = await prisma.timeSlot.create({
        data: {
          doctorId: doctor.id,
          startTime,
          endTime,
        },
      });
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          timeSlots: {
            connect: { id: timeSlot.id },
          },
        },
      });
    });

    res.status(200).json(new ApiResponse(200, "Timeslot added successfully"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal server error", [error]));
  }
};

const cancelAppointment = async (req: UserRequest, res: any) => {
  const { appointmentId } = req.params;
  const doctorId = req.user?.doctor?.id;

  try {
    if (!doctorId) {
      res
        .status(400)
        .json(new ApiError(400, "Only doctor can cancel Appointments!"));
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment || doctorId !== appointment.doctorId) {
      res
        .status(400)
        .json(new ApiError(400, "Appointment not found or Unauthorized"));
    } else if (appointment.status === AppointmentStatus.CANCELLED) {
      res.status(400).json(new ApiError(400, "Appointment already Cancelled!"));
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
      },
    });

    // Update time slot if it exists
    if (appointment?.timeSlotId) {
      await prisma.timeSlot.update({
        where: { id: appointment.timeSlotId },
        data: {
          status: TimeSlotStatus.AVAILABLE,
        },
      });
    }
    return res
      .status(200)
      .json(new ApiResponse(500, "Appointment Cancelled successfully!"));
  } catch (error) {
    res
      .status(500)
      .json(
        new ApiError(500, "Error occured while cancelling appointment!", [
          error,
        ])
      );
  }
};

const viewTimeslots = async (req: UserRequest, res: Response) => {
  const { status, startTime, endTime } = req.query; //status = AVAILABLE,BOOKED,CANCELLED
  const userId = req.user?.id;

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      res.status(400).json(new ApiError(400, "Doctor not found"));
      return;
    }

    const filters: any = {
      doctorId: doctor.id,
    };
    if (status && typeof status === "string") {
      filters.status = status as TimeSlotStatus;
    }
    if (startTime) {
      filters.startTime = { gte: startTime };
    }
    if (endTime) {
      filters.endTime = { lte: endTime };
    }
    const timeSlots = await prisma.timeSlot.findMany({
      where: filters,
      include: {
        appointment: {
          include: {
            patient: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    res.status(200).json(new ApiResponse(200, timeSlots));
  } catch (error) {
    res.status(500).json(new ApiError(500, "internal server error", [error]));
  }
};

const getPatientHistory = async (req: UserRequest, res: Response) => {
  const patientId = req.params;
  const user = req.user;

  if (!patientId) {
    res.status(400).json(new ApiError(400, "Patient not found!"));
    return;
  }
  if (!user?.doctor) {
    res
      .status(400)
      .json(new ApiError(400, "Only doctor can get patient history!"));
    return;
  }
  try {
    const history = await prisma.patientHistory.findMany({
      where: { patientId },
      include: {
        appointment: true,
        prescription: true,
        doctor: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            specialty: true,
          },
        },
      },
      orderBy: { dateRecorded: "desc" },
    });

    res.status(200).json(new ApiResponse(500, history));
  } catch (error) {
    res.status(500).json(new ApiError(400, "Failed to fetch patient history!"));
  }
};

const updateTimeSlot = async (req: UserRequest, res: Response) => {
  const timeSlotId = req.params.timeSlotId;
  const doctorId = req.user?.doctor?.id;
  const { startTime, endTime, status } = req.body;

  if (!doctorId) {
    res.status(403).json(new ApiError(403, "Unauthorized:Doctor not found!"));
    return;
  }

  try {
    await prisma.timeSlot.update({
      where: { id: timeSlotId },
      data: {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        status: status || undefined,
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Time slot updated successfully!"));
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to update timeslots"));
  }
};

const deleteTimeSlot = async (req: UserRequest, res: Response) => {
  const timeSlotID = req.params.timeSlotID;
  const doctorId = req.user?.doctor?.id;

  if (!doctorId) {
    res
      .status(400)
      .json(new ApiError(400, "Only doctor can delete time slots!"));
    return;
  }

  try {
    const timeSlot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotID },
      include: { appointment: true }, // Include related appointments
    });

    if (!timeSlot || timeSlot.doctorId !== doctorId) {
      res
        .status(404)
        .json(new ApiError(400, "Time slot not found or unauthorized"));
      return;
    } else if (timeSlot.appointment.length > 0) {
      res
        .status(400)
        .json(
          new ApiError(400, "Cannot delete time slot with existing appointment")
        );
      return;
    }

    await prisma.timeSlot.delete({
      where: { id: timeSlotID },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Time slot successfully deleted!"));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to delete time slot", [error]));
  }
};

const cityRooms = async (req : UserRequest , res : Response) => {
  try{
    const userId = req?.user?.id;

    const rooms = await prisma.room.findMany({
      where : {
        members : {
          some : {
            id : userId
          }
        }
      },
      include : {
        members : {
          select : {
            id : true,
            name : true,
            profilePicture : true
          }
        },
        admin : {
          select : {
            id : true,
            name : true,
            profilePicture : true
          }
        },
      }
    })

    res.status(200).json(new ApiResponse(200 ,rooms));
    return
  }catch(err){
    res.status(500).json(new ApiError(500 , "Internal server error " , [err]));
    return;
  }
}

const createRoom = async (req : UserRequest , res : Response) => {
  try{
    const id = req.user?.id;
    const {roomName} = req.body;

    if(!roomName){
      res.status(404).json(new ApiError(404 , "roomname is missing"));
      return;
    }

    const room = await prisma.room.create({
      data: {
        name: roomName,
        members: {
          connect: [{ id }]
        },
        admin: {
          connect: [{ id }]
        }
      }

    });
    res.status(200).json(new ApiResponse(200 ,room , "Room created Successfully"));
    return;
  }catch(err){
    res.status(500).json(new ApiError(500 , "Internal server error" , [err]));
    return;
  }
}

const getAllDoctorAppointments = async (req: UserRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { status, upcoming } = req.query; // status=PENDING/CONFIRMED/COMPLETED/CANCELLED, upcoming=true

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

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
      filters.date = {
        gte: new Date(),
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: filters,
      include: {
        patient: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                profilePicture: true,
                email: true,
              },
            },
            medicalHistory: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { time: "asc" },
      ],
    });

    const formattedAppointments = appointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      appointmentType: appointment.appointmentType,
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes,
      consultationFee: appointment.consultationFee,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      patient: {
        id: appointment.patient.id,
        name: appointment.patient.user.name,
        profilePicture: appointment.patient.user.profilePicture,
        email: appointment.patient.user.email,
        medicalHistory: appointment.patient.medicalHistory,
      },
    }));

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res.status(500).json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

export {
  viewDoctorAppointment,
  updateAppointmentStatus,
  addTimeslot,
  viewTimeslots,
  cancelAppointment,
  getPatientHistory,
  updateTimeSlot,
  deleteTimeSlot,
  cityRooms,
  createRoom,
  getAllDoctorAppointments
};
