import { Server, Socket } from "socket.io";
import { handleRoomSocket } from "./roomManager";
import { handleDmSocket } from "./dmManager";

export function setupChatSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    try {
      handleRoomSocket(io, socket);
      handleDmSocket(io, socket);
    } catch (error) {
      console.error("Error setting up socket handlers:", error);
    }

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}
