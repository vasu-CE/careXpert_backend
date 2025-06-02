import express from "express";
//import individual routes here ---
import userRoute from "./user.routes";
import doctorRoutes from "./doctor.routes";
import patientRoutes from "./patient.routes";
import chatRoutes from "./chat.routes";

const router = express.Router();

//group all routes here---
router.use("/user", userRoute);
router.use("/doctor", doctorRoutes);
router.use("/patient", patientRoutes);
router.use("/chat", chatRoutes);

export default router;
