import express from "express";
//import individual routes here ---
import userRoute from "./user.routes";
import doctorRoutes from "./doctor.routes";
import patientRoutes from "./patient.routes";
import chatRoutes from "./chat.routes";
import aiChatRoutes from "./ai-chat.routes";
import reportRoutes from "./report.routes";

const router = express.Router();

//group all routes here---
router.use("/user", userRoute);
router.use("/doctor", doctorRoutes);
router.use("/patient", patientRoutes);
router.use("/chat", chatRoutes);
router.use("/ai-chat", aiChatRoutes);
router.use("/report", reportRoutes);

export default router;
