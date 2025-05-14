import { Router } from "express";
import { isPatient } from "../utils/helper";
import {
  bookAppointment,
  getPatientAppointments,
  availableTimeSlots,
} from "../controllers/appointment.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();

// Protected routes (require patient authentication)
router.get("/:doctorId/timeSlots", availableTimeSlots);
router.post("/book",isAuthenticated , isPatient, bookAppointment);
router.get("/my-appointments",isAuthenticated , isPatient, getPatientAppointments);

export default router;
