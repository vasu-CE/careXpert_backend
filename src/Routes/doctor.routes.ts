import { Router } from "express";
import {viewDoctorAppointment , updateAppointmentStatus, addTimeslot,viewTimeslots, cancelAppointment, getPatientHistory, updateTimeSlot, deleteTimeSlot, cityRooms, createRoom} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();

// Add type assertions to route handlers to resolve TypeScript errors
router.post("/add-timeslot", isAuthenticated, isDoctor, addTimeslot as any);
router.get("/view-timeslots", isAuthenticated, isDoctor, viewTimeslots as any);
router.get("/appointments", isAuthenticated, isDoctor, viewDoctorAppointment as any);
router.patch("/appointments/:id", isAuthenticated, isDoctor, updateAppointmentStatus as any);
router.patch("/cancel-appointment/:appointmentId", isAuthenticated, isDoctor, cancelAppointment as any);
router.get("/patient-history/:patientId", isAuthenticated, isDoctor, getPatientHistory as any);
router.patch("/update-timeSlot/:timeSlotID", isAuthenticated, isDoctor, updateTimeSlot as any);
router.delete("/delete-timeSlot/:timeSlotId", isAuthenticated, isDoctor, deleteTimeSlot as any);
router.get('/city-rooms', isAuthenticated, isDoctor, cityRooms as any);
router.put("/create-room", isAuthenticated, isDoctor, createRoom as any);

export default router;

