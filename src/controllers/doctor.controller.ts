import { Response } from "express";
import { PrismaClient, TimeSlotStatus } from "../generated/prisma";
import { UserRequest } from "../utils/helper";
import { isValidUUID } from "../utils/helper";

const prisma = new PrismaClient();

export const searchDoctors = async (
  req: UserRequest,
  res: Response
): Promise<void> => {
  const { specialty, location } = req.query;

  // Input validation
  if (!specialty && !location) {
    res.status(400).json({
      error:
        "At least one search parameter (specialty or location) is required",
    });
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

    res.status(200).json({
      success: true,
      data: doctors,
      count: doctors.length,
      filters: {
        specialty: specialty || null,
        location: location || null,
      },
    });
  } catch (error) {
    console.error("Error in searchDoctors:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search doctors",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};





