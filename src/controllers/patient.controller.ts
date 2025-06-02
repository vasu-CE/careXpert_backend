import { Response } from "express";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import { isValidUUID, UserRequest } from "../utils/helper";
import { TimeSlotStatus, AppointmentStatus, Role } from "@prisma/client";

const searchDoctors = async (req: any, res: Response) => {
  const { specialty, location } = req.query;

  // Input validation
  if (!specialty && !location) {
    res
      .status(400)
      .json(
        new ApiError(
          400,
          "At least one search parameter (specialty or location) is required"
        )
      );
    return;
  }

  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        AND: [
          specialty
            ? {
                specialty: {
                  contains: specialty as string,
                  mode: "insensitive", // Case-insensitive search
                },
              }
            : {},
          location
            ? {
                clinicLocation: {
                  contains: location as string,
                  mode: "insensitive", // Case-insensitive search
                },
              }
            : {},
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json(new ApiResponse(200, doctors));
  } catch (error) {
    // console.error("Error in searchDoctors:", error);
    res.status(500).json(new ApiError(500, "Internal Server Error", [error]));
  }
};

const availableTimeSlots = async (req: any, res: Response): Promise<void> => {
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

    res.status(200).json(new ApiResponse(200, formattedSlots));
  } catch (error) {
    res.status(400).json(new ApiError(400, "Internal Server Error", [error]));
  }
};

const bookAppointment = async (req: any, res: Response): Promise<void> => {
  const { timeSlotId } = req.body;
  // const patientId = req.user?.patient?.id; // Get patient ID from authenticated user
  const userId = req.user?.id;
  const patient = await prisma.patient.findUnique({
    where: { userId },
    select: { id: true },
  });

  try {
    // Validate patient is logged in and has a patient profile
    if (!patient) {
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
        res.status(404).json({
          success: false,
          message: "Time slot not found",
        });
        return;
      }

      if (timeSlot.status !== TimeSlotStatus.AVAILABLE) {
        // throw new Error("This time slot is no longer available");
        res.status(400).json(new ApiError(400, "Timeslote is already booked"));
        return;
      }

      // Check if patient already has an appointment at this time
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          status: {
            in: [AppointmentStatus.COMPLETED, AppointmentStatus.PENDING],
          },
          patientId: patient.id,
          timeSlot: {
            startTime: { lt: timeSlot.endTime },
            endTime: { gt: timeSlot.startTime },
          },
        },
      });
      // console.log(existingAppointment)

      if (existingAppointment) {
        res
          .status(400)
          .json(new ApiError(400, "You have already appointment in this time"));
        return;
      }
      // Create appointment and update time slot status
      const [appointment, updatedTimeSlot] = await Promise.all([
        prisma.appointment.create({
          data: {
            patientId: patient.id,
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
      id: result?.appointment.id,
      status: result?.appointment.status,
      patientName: result?.appointment.patient.user.name,
      doctorName: result?.appointment.doctor.user.name,
      specialty: result?.appointment.doctor.specialty,
      location: result?.appointment.doctor.clinicLocation,
      appointmentTime: {
        start: result?.appointment.timeSlot.startTime,
        end: result?.appointment.timeSlot.endTime,
      },
    };

    res.status(200).json(
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
const getPatientAppointments = async (
  req: any,
  res: Response
): Promise<void> => {
  const patientId = req.user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can view their appointments!"));
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

    res.status(200).json(new ApiResponse(200, formattedAppointments));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const cancelAppointment = async (req: UserRequest, res: Response) => {
  const { appointmentId } = req.params;
  const patientId = req.user?.patient?.id;

  try {
    if (!patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Only patients can cancel Appointments!"));
      return;
    }
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { timeSlot: true },
    });

    if (!appointment || patientId !== appointment.patientId) {
      res
        .status(400)
        .json(new ApiError(400, "Appointment not found or Unauthorized"));
      return;
    } else if (appointment.status === AppointmentStatus.CANCELLED) {
      res.status(400).json(new ApiError(400, "Appointment already Cancelled!"));
      return;
    }

    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
        },
      }),
      prisma.timeSlot.update({
        where: { id: appointment?.timeSlotId },
        data: {
          status: TimeSlotStatus.AVAILABLE,
        },
      }),
    ]);
    res
      .status(200)
      .json(new ApiResponse(500, "Appointment Cancelled successfully!"));
  } catch (error) {
    res
      .status(400)
      .json(
        new ApiError(400, "Error occured while cancelling appointment!", [
          error,
        ])
      );
  }
};

const viewPrescriptions = async (req: UserRequest, res: Response) => {
  const patientId = req.user?.patient?.id;

  if (!patientId) {
    res
      .status(400)
      .json(new ApiError(400, "Only patients can view appointments!"));
    return;
  }
  try {
    const Prescriptions = await prisma.prescription.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            specialty: true,
            clinicLocation: true,
            user: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: {
        dateIssued: "desc",
      },
    });

    const formatted = Prescriptions.map((p) => ({
      id: p.id,
      dateIssued: p.dateIssued,
      prescriptionText: p.prescriptionText,
      doctorName: p.doctor.user.name,
      specialty: p.doctor.specialty,
      clinicLocation: p.doctor.clinicLocation,
    }));

    res.status(200).json(new ApiResponse(200, formatted));
  } catch (error) {
    res
      .status(500)
      .json(new ApiError(500, "Failed to fetch appointments!", [error]));
  }
};

const prescriptionPdf = async (req: UserRequest, res: Response) => {
  try {
    const prescriptionId = req.params.id as string;

    if(!prescriptionId || !isValidUUID(prescriptionId)){
      res.status(400).json(new ApiResponse(400 , "Invalid prescription id"));
      return;
    }
    
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include : {
        patient : {
          select : {
            user : {
              select : {
                name : true,
                email : true,  
              }
            }
          }
        },
        doctor : {
          select : {
            specialty : true,
            clinicLocation : true,
            user : {
              select : {
                name : true,
                email : true
              }
            }
          },
        }
      }
    })

    res.status(200).json(new ApiResponse(200 , prescription));
  } catch (error) {
    res.status(500).json(new ApiError(500 , "internal server error" , [error]));
  }
}

export {
  searchDoctors,
  availableTimeSlots,
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  viewPrescriptions,
  prescriptionPdf
};
