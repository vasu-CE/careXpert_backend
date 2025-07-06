import { Server, Socket } from "socket.io";
import { formatMessage } from "./utils";
import { PrismaClient } from "@prisma/client";
import { uploadToCloudinary } from "../utils/cloudinary";

const prisma = new PrismaClient();
interface DmMessageData {
  roomId: string;
  senderId: string;
  receiverId: string;
  username: string;
  text: string;
  image?: string;
}

export function handleDmSocket(io: Server, socket: Socket) {
  socket.on(
    "joinDmRoom",
    async (roomId : string ) => {
      try {
        // const { roomId } = message;
        socket.join(roomId);

        // const clients = await io.in(roomId).allSockets();
        // // console.log(`${socket.id} joined room ${roomId}`);
        // console.log(`Room ${roomId} has ${clients.size} user(s)`);
    
        // if (clients.size === 2) {
        //   // Notify both users that chat is ready
        //   io.to(roomId).emit("bothUsersJoined", { roomId });
        // }
      } catch (error) {
        console.error("Error in joinDmRoom:", error);
        socket.emit("error", "Failed to join DM room");
      }
    }
  );

  socket.on(
    "dmMessage",
    async (message: { event: string; data: DmMessageData }) => {
      try {
        const { roomId, senderId, receiverId, username, text, image } =
          message.data;
        let messageData: any = {
          roomId,
          senderId,
          username,
          text,
        };

        if (image) {
          try {
            const imageUrl = await uploadToCloudinary(image);
            messageData = {
              ...messageData,
              messageType: "IMAGE",
              imageUrl,
            };
          } catch (error) {
            console.error("Error uploading image:", error);
            socket.emit("error", "Failed to upload image");
            return;
          }
        }

        const formattedMessage = formatMessage(messageData);
        // console.log(formattedMessage)
        io.to(roomId).emit("message", formattedMessage);

        await prisma.chatMessage.create({
          data: {
            senderId: senderId,
            receiverId: receiverId,
            roomId : roomId,
            message: text,
            messageType: image ? "IMAGE" : "TEXT",
            imageUrl: image ? formattedMessage.imageUrl : null,
          },
        });
      } catch (error) {
        console.error("Error in dmMessage:", error);
        socket.emit("error", "Failed to send DM message");
      }
    }
  );
}
