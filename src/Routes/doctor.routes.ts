import { Router } from "express";
import {viewDoctorAppointment , updateAppointmentStatus} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();


router.get("/appointments",isAuthenticated,isDoctor,viewDoctorAppointment)
router.patch("/appointments/:id",isAuthenticated,isDoctor,updateAppointmentStatus)
export default router;

