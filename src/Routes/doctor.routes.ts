import { Router } from "express";
import {viewDoctorAppointment , updateAppointmentStatus, addTimeslot,viewTimeslots, cancelAppointment, getPatientHistory} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();

router.post("/add-timeslot" , isAuthenticated , isDoctor , addTimeslot);
router.get("/view-timeslots" , isAuthenticated , isDoctor , viewTimeslots);

router.get("/appointments",isAuthenticated,isDoctor,viewDoctorAppointment)
router.patch("/appointments/:id",isAuthenticated,isDoctor,updateAppointmentStatus)
router.patch("/cancel-appointment/:appointmentId",isAuthenticated,isDoctor,cancelAppointment);
router.get("/patient-history/:patientId",isAuthenticated,isDoctor,getPatientHistory);
export default router;

