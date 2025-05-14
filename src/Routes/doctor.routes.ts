import { Router } from "express";
import {viewDoctorAppointment , updateAppointmentStatus, addTimeslot, cancelAppointment} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();


router.post("/add-timeslot" , isAuthenticated , isDoctor , addTimeslot);
router.get("/appointments",isAuthenticated,isDoctor,viewDoctorAppointment);
router.patch("/appointments/:id",isAuthenticated,isDoctor,updateAppointmentStatus);
router.patch("/cancel-appointment/:appointmentId",isAuthenticated,isDoctor,cancelAppointment);
export default router;

