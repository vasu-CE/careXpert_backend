import { Response } from "express";
import { UserRequest } from "../utils/helper";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const prisma = new PrismaClient();

export const searchDoctors = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
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