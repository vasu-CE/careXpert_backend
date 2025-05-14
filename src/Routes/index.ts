import express from "express";
//import individual routes here ---
import userRoute from "./user.routes";
import doctorRoutes from "./doctor.routes";
import patientRoutes from "./patient.routes";


const router = express.Router();

//group all routes here---
router.use("/user" , userRoute);
router.use("/doctors", doctorRoutes);
router.use("/patient",patientRoutes)



export default router;
