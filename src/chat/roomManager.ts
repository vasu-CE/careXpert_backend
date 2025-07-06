import { Server, Socket } from "socket.io";
import { formatMessage } from "./utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface JoinRoomData {
  userId: string;
  username: string;
  roomId: string;
}

interface RoomMessageData {
  senderId: string;
  username: string;
  roomId: string;
  text: string;
  image?: string;
}

export function handleRoomSocket(io: Server, socket: Socket) {
  socket.on(
    "joinRoom",
    async (message: { event: string; data: JoinRoomData }) => {
      try {
        const { userId, username, roomId } = message.data;

        socket.join(roomId);

        const welcomeMsg = formatMessage({
          senderId: undefined,
          username: "CareXpert Bot",
          text: `Welcome to ${roomId} room!`,
        });

        socket.emit("message", welcomeMsg);

        socket.broadcast.to(roomId).emit(
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
        const { senderId, username, roomId, text } = message.data;

        const messageData = {
          roomId,
          senderId,
          username,
          text,
        };

        const formattedMessage = formatMessage(messageData);

        // Broadcast
        io.in(roomId).emit("message", formattedMessage);

        // Persist to DB
        await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            roomId: roomId,
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
