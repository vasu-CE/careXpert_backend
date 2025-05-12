import { Router } from "express";
import { isPatient } from "../utils/helper";
import {
  bookAppointment,
  getPatientAppointments,
  availableTimeSlots,
} from "../controllers/appointment.controller";

const router = Router();

// Protected routes (require patient authentication)
router.get("/:doctorId/timeSlots", availableTimeSlots);
router.post("/book", isPatient, bookAppointment);
router.get("/my-appointments", isPatient, getPatientAppointments);

export default router;
