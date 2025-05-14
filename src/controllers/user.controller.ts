import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { Response } from "express";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { Role } from "@prisma/client";
import { Request } from "express";
import { hash } from "crypto";
import { isValidUUID } from "../utils/helper";
import { TimeSlotStatus,AppointmentStatus } from "@prisma/client";

const generateToken =async (userId : string) => {
    try{
        const accessToken = generateAccessToken(userId);
        const refreshToken = generateRefreshToken(userId);

        await prisma.user.update({
            where : {id : userId},
            data : {refreshToken}
        });

        return {accessToken , refreshToken};
    }catch(err){
        throw new ApiError(500 , "Error in generating token");
    }
}

interface UserRequest extends Request{
    body : {
        name : string,
        email : string,
        password : string,
        role : Role,
        clinicLocation : string,
        specialty : string
    }
}

const signup = async (req:UserRequest , res:any)  => {
    const {name ,email , password , role ,specialty , clinicLocation} = req.body;
    
    if([name ,email , password].some((field) => field?.trim() === "")) {   
        return res.status(400).json(new ApiError(400 , "All field required"));
    }

    if(role === "DOCTOR"){
        if(!specialty || !clinicLocation){
            return res.status(400).json(new ApiError(400 , "all field are required"));
        }
    }
    try{
        let existingUser = await prisma.user.findFirst({
            where : {name}
        });

        if(existingUser){
            return res.status(409).json(new ApiError(409 , "Username already taken"));
        }
        existingUser = await prisma.user.findUnique({
            where : {email}
        })
        if(existingUser){
            return res.status(409).json(new ApiError(409 , "User already exist"));
        }

        const hashedPassword = await bcrypt.hash(password , 10)
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data : {
                    name : name.toLowerCase(),
                    email,
                    password : hashedPassword,
                    role,
                }
            });

            if(role === "DOCTOR"){
                await prisma.doctor.create({
                    data :{
                        userId : user.id,
                        specialty,
                        clinicLocation
                    }
                })
            }else{
                await prisma.patient.create({
                    data : { userId : user.id}
                });
            }

            return user;
        })
        return res.status(200).json(
            new ApiResponse(200 , {user : result} , "Signup successfully")
        )
    }catch(err){
        console.log(err);
        return res.status(500).json(new ApiError(500 , "Internal server error" , [err]));
    }
}

const login = async (req:any , res:any) => {
    const {name ,email , password} = req.body;
    try{
        if(!email && !name){
            return res.json(new ApiError(400 , "username or email is required"));
        }
        if([password].some((field) => field.trim() === "")){
            return res.json(new ApiError(400 , "All field required"));
        }

        const user = await prisma.user.findFirst({
            where : {
                OR : [
                    {email : {equals : email , mode : 'insensitive'}},
                    {name : {equals : name , mode : 'insensitive'}}
                ]
            }, 
        });

        if(!user){
            return res.status(401).json(new ApiError(401 , "Invalid username or password"));
        }

        const match = await bcrypt.compare(password , user.password);
        if(!match){
            return res.status(401).json(new ApiError(401 , "Invalid username or password"));
        }

        const {accessToken , refreshToken} = await generateToken(user.id);

        // const {password , ...loggedInUser} = user;

        const options = {
            httpOnly : true, //only modified by server
            secure : true
        }
        
        return res.status(200)
        .cookie("accessToken" , accessToken , options)
        .cookie("refreshToken" , refreshToken , options)
        .json(new ApiResponse(200 , user , "Login successfully"));

    }catch(err){
        return res.status(500).json(new ApiError(500 , "Internal server error"));
    }
}

const logout = async (req:any , res:any) => {
    try{
        const id = req.user.id;

        await prisma.user.update({
            where : {id},
            data : {refreshToken : ""}
        });

        const options = {
            httpOnly : true,
            secure : true
        }


        return res.status(200)
        .clearCookie("accessToken" , options)
        .clearCookie("refresToken" , options)
        .json(new ApiResponse(200 , "Logout successfully"));
    }catch(err){
        return res.status(500).json(new ApiError(500 , "internal server error"));
    }
}

const searchDoctors = async (
  req: any,
  res: any
) =>{
  const { specialty, location } = req.query;

  // Input validation
  if (!specialty && !location) {
    res.status(400).json(new ApiError(400 ,"At least one search parameter (specialty or location) is required"));
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

    res.status(200).json(new ApiResponse(200 , 
      {doctors ,
        filters: {
          specialty: specialty || null,
          location: location || null,
        },
      }));

  } catch (error) {
    // console.error("Error in searchDoctors:", error);
    res.status(500).json(new ApiError(500 , "Internal Server Error" , [error])); 
  }
};

const availableTimeSlots = async (
  req: any,
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

const bookAppointment = async (
  req: any,
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
const getPatientAppointments = async (
  req: any,
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




export {
    signup,
    login,
    logout,
    searchDoctors,
    availableTimeSlots,
    bookAppointment,
    getPatientAppointments
}