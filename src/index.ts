import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./Routes/index";
import cookieParser from "cookie-parser";
import { Server, Socket } from "socket.io";
import http from "http";
import { handleRoomSocket } from "./chat/roomManager";
import { handleDmSocket } from "./chat/dmManager";

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin : "http://localhost:5173",
  credentials : true
}));
app.use(express.json());
app.use(cookieParser());

// Use Routes
app.use("/api", routes);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});

export function setupChatSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Temporary test message
    socket.emit("test_message", { data: "Connection successful!" });

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

setupChatSocket(io);

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
