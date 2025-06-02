import { Server, Socket } from "socket.io";
import { formatMessage } from "./utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface JoinRoomData {
  userId: string;
  username: string;
  city: string;
}

interface RoomMessageData {
  senderId: string;
  username: string;
  city: string;
  text: string;
}

export function handleRoomSocket(io: Server, socket: Socket) {
  socket.on(
    "joinRoom",
    async (message: { event: string; data: JoinRoomData }) => {
      try {
        const { userId, username, city } = message.data;

        socket.join(city);

        const welcomeMsg = formatMessage({
          senderId: undefined,
          username: "CareXpert Bot",
          text: `Welcome to ${city} room!`,
        });

        socket.emit("message", welcomeMsg);

        socket.broadcast.to(city).emit(
          "message",
          formatMessage({
            senderId: undefined,
            username: "CareXpert Bot",
            text: `${username} has joined the room.`,
          })
        );
      } catch (error) {
        console.error("Error in joinRoom:", error);
        socket.emit("error", "Failed to join room");
      }
    }
  );

  socket.on(
    "roomMessage",
    async (message: { event: string; data: RoomMessageData }) => {
      try {
        const { senderId, username, city, text } = message.data;

        const messageData = {
          senderId,
          username,
          text,
        };

        const formattedMessage = formatMessage(messageData);

        // Broadcast
        io.in(city).emit("message", formattedMessage);

        // Persist to DB
        await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            room: city,
            message: text,
            messageType: "TEXT",
            imageUrl: null,
          },
        });
      } catch (error) {
        console.error("Error in roomMessage:", error);
        socket.emit("error", "Failed to send message");
      }
    }
  );
}
