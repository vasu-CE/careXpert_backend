import { Router } from "express";
import {
  viewDoctorAppointment,
  updateAppointmentStatus,
  addTimeslot,
  viewTimeslots,
  cancelAppointment,
  getPatientHistory,
  updateTimeSlot,
  deleteTimeSlot,
  cityRooms,
  createRoom,
  getAllDoctorAppointments,
  getPendingAppointmentRequests,
  respondToAppointmentRequest,
  getDoctorNotifications,
  markNotificationAsRead,
  addPrescriptionToAppointment,
  markAppointmentCompleted,
} from "../controllers/doctor.controller";
import { isDoctor } from "../utils/helper";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = Router();

router.post("/add-timeslot", isAuthenticated, isDoctor, addTimeslot);
router.get("/view-timeslots", isAuthenticated, isDoctor, viewTimeslots);

router.get("/appointments", isAuthenticated, isDoctor, viewDoctorAppointment);
router.patch(
  "/appointments/:id",
  isAuthenticated,
  isDoctor,
  updateAppointmentStatus
);
router.patch(
  "/cancel-appointment/:appointmentId",
  isAuthenticated,
  isDoctor,
  cancelAppointment
);
router.get(
  "/patient-history/:patientId",
  isAuthenticated,
  isDoctor,
  getPatientHistory
);
router.patch(
  "/update-timeSlot/:timeSlotID",
  isAuthenticated,
  isDoctor,
  updateTimeSlot
);
router.delete(
  "/delete-timeSlot/:timeSlotId",
  isAuthenticated,
  isDoctor,
  deleteTimeSlot
);

router.get("/city-rooms", isAuthenticated, isDoctor, cityRooms);
router.put("/create-room", isAuthenticated, isDoctor, createRoom);

// New direct appointment routes
router.get(
  "/all-appointments",
  isAuthenticated,
  isDoctor,
  getAllDoctorAppointments as any
);

// New appointment request management routes
router.get(
  "/pending-requests",
  isAuthenticated,
  isDoctor,
  getPendingAppointmentRequests
);

router.patch(
  "/appointment-requests/:appointmentId/respond",
  isAuthenticated,
  isDoctor,
  respondToAppointmentRequest
);

// Prescription and completion routes
router.post(
  "/appointments/:appointmentId/prescription",
  isAuthenticated,
  isDoctor,
  addPrescriptionToAppointment
);
router.patch(
  "/appointments/:appointmentId/complete",
  isAuthenticated,
  isDoctor,
  markAppointmentCompleted
);

// Notification routes
router.get(
  "/notifications",
  isAuthenticated,
  isDoctor,
  getDoctorNotifications
);

router.patch(
  "/notifications/:notificationId/read",
  isAuthenticated,
  isDoctor,
  markNotificationAsRead
);

export default router;
