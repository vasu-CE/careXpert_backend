import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Controller to get messages for a room (city chat)
export const getRoomMessages = async (req: Request, res: any) => {
  try {
    const { city } = req.params;

    if (!city) {
      return res
        .status(400)
        .json(new ApiError(400, "City parameter is missing"));
    }

    // Fetch messages for the specified room
    const messages = await prisma.chatMessage.findMany({
      where: {
        room: city, // Filter by room name (city)
        // Assuming room messages have receiverId as null or undefined
        receiverId: null,
      },
      orderBy: {
        timestamp: "asc", // Order by timestamp ascending
      },
      // You might want to limit the number of messages and implement pagination later
      // take: 100,
    });

    return res.status(200).json({
      success: true,
      data: messages,
      message: "Room messages fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching room messages:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch room messages", [error]));
  }
};

// Controller to get messages for a direct message chat
export const getDmMessages = async (req: Request, res: any) => {
  try {
    const { roomId } = req.params;
    // You might also want to validate that the requesting user is part of this DM conversation

    if (!roomId) {
      return res
        .status(400)
        .json(new ApiError(400, "Room ID parameter is missing"));
    }

    // Fetch messages for the specified DM room
    const messages = await prisma.chatMessage.findMany({
      where: {
        room: roomId, // Filter by DM room ID
        // Assuming DM messages always have receiverId not null/undefined
        NOT: { receiverId: null },
      },
      orderBy: {
        timestamp: "asc", // Order by timestamp ascending
      },
      // You might want to limit the number of messages and implement pagination later
      // take: 100,
    });

    return res.status(200).json({
      success: true,
      data: messages,
      message: "DM messages fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching DM messages:", error);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to fetch DM messages", [error]));
  }
};
