import { Response } from "express";
import { UserRequest, isValidUUID } from "../utils/helper";
import {
  PrismaClient,
  AppointmentStatus,
  TimeSlotStatus,
} from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

const prisma = new PrismaClient();

export const availableTimeSlots = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const { doctorId } = req.params;
  const date = req.query.date as string | undefined;

  try {
    // Validate doctorId format
    if (!doctorId || !isValidUUID(doctorId)) {
      res.status(400).json(new ApiError(400, "Invalid Doctor ID"));
      return;
    }

    // Check if doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      res.status(400).json(new ApiError(400, "Doctor not available"));
      return;
    }

    // Build where condition
    const whereCondition: any = {
      doctorId,
      status: TimeSlotStatus.AVAILABLE,
    };

    if (date) {
      const selectedDate = new Date(date as string);
      if (isNaN(selectedDate.getTime())) {
        res
          .status(400)
          .json(
            new ApiError(400, "Invalid Date format use ISO format(YYYY-MM-DD)")
          );
        return;
      }

      // Set time range for the selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      whereCondition.startTime = {
        gte: startOfDay,
        lt: endOfDay,
      };
    }

    // Fetch available time slots
    const availableSlots = await prisma.timeSlot.findMany({
      where: whereCondition,
      orderBy: {
        startTime: "asc",
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        doctor: {
          select: {
            specialty: true,
            clinicLocation: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Format the response
    const formattedSlots = availableSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
      doctorName: slot.doctor.user.name,
      specialty: slot.doctor.specialty,
      location: slot.doctor.clinicLocation,
    }));

    res.status(200).json(
      new ApiResponse(200, {
        data: formattedSlots,
        count: formattedSlots.length,
        filters: {
          doctorId,
          date: date || null,
        },
      })
    );
  } catch (error) {
    res.status(400).json(new ApiError(400, "Internal Server Error", [error]));
  }
};

export const bookAppointment = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const { timeSlotId } = req.body;
  const patientId = req.user?.patient?.id; // Get patient ID from authenticated user

  try {
    // Validate patient is logged in and has a patient profile
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can book appointments!"));
      return;
    }

    // Validate timeSlotId
    if (!timeSlotId) {
      res.status(400).json(new ApiError(400, "Time slot id is required"));
      return;
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (prisma) => {
      // Get the time slot and check if it's available
      const timeSlot = await prisma.timeSlot.findUnique({
        where: { id: timeSlotId },
        include: {
          doctor: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!timeSlot) {
        throw new Error("Time slot not found");
      }

      if (timeSlot.status !== TimeSlotStatus.AVAILABLE) {
        throw new Error("This time slot is no longer available");
      }

      // Check if patient already has an appointment at this time
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          patientId,
          timeSlot: {
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime,
          },
        },
      });

      if (existingAppointment) {
        throw new Error(
          "You already have an appointment scheduled at this time"
        );
      }

      // Create appointment and update time slot status
      const [appointment, updatedTimeSlot] = await Promise.all([
        prisma.appointment.create({
          data: {
            patientId,
            doctorId: timeSlot.doctorId,
            timeSlotId,
            status: AppointmentStatus.PENDING,
          },
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
            doctor: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
                specialty: true,
                clinicLocation: true,
              },
            },
            timeSlot: true,
          },
        }),
        prisma.timeSlot.update({
          where: { id: timeSlotId },
          data: { status: TimeSlotStatus.BOOKED },
        }),
      ]);

      return { appointment, updatedTimeSlot };
    });

    // Format the response
    const formattedAppointment = {
      id: result.appointment.id,
      status: result.appointment.status,
      patientName: result.appointment.patient.user.name,
      doctorName: result.appointment.doctor.user.name,
      specialty: result.appointment.doctor.specialty,
      location: result.appointment.doctor.clinicLocation,
      appointmentTime: {
        start: result.appointment.timeSlot.startTime,
        end: result.appointment.timeSlot.endTime,
      },
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, {
          data: formattedAppointment,
          message: "Appointment booked successfully",
        })
      );
  } catch (error) {
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};

// Get patient's appointments
export const getPatientAppointments = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const patientId = req.user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can view there appointments!"));
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            specialty: true,
            clinicLocation: true,
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
      doctorName: appointment.doctor.user.name,
      specialty: appointment.doctor.specialty,
      location: appointment.doctor.clinicLocation,
      appointmentTime: {
        start: appointment.timeSlot.startTime,
        end: appointment.timeSlot.endTime,
      },
    }));

    res.status(200).json(
      new ApiResponse(200, {
        data: formattedAppointments,
        count: formattedAppointments.length,
      })
    );
  } catch (error) {
    res.status(500).json(new ApiError(500, "Failed to fetch appointments!",[error]));
  }
};
