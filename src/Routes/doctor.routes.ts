import { Router } from "express";
import {viewDoctorAppointment , updateAppointmentStatus, addTimeslot,viewTimeslots, cancelAppointment, getPatientHistory, updateTimeSlot, deleteTimeSlot, cityRooms, createRoom, getAllDoctorAppointments} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();

router.post("/add-timeslot" , isAuthenticated , isDoctor , addTimeslot);
router.get("/view-timeslots" , isAuthenticated , isDoctor , viewTimeslots);

router.get("/appointments",isAuthenticated,isDoctor,viewDoctorAppointment)
router.patch("/appointments/:id",isAuthenticated,isDoctor,updateAppointmentStatus)
router.patch("/cancel-appointment/:appointmentId",isAuthenticated,isDoctor,cancelAppointment);
router.get("/patient-history/:patientId",isAuthenticated,isDoctor,getPatientHistory);
router.patch("/update-timeSlot/:timeSlotID",isAuthenticated,isDoctor,updateTimeSlot);
router.delete("/delete-timeSlot/:timeSlotId",isAuthenticated,isDoctor,deleteTimeSlot);

router.get('/city-rooms',isAuthenticated , isDoctor , cityRooms);
router.put("/create-room" , isAuthenticated , isDoctor , createRoom);

// New direct appointment routes
router.get("/all-appointments", isAuthenticated, isDoctor, getAllDoctorAppointments);

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

