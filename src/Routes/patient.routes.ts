import express, { Router } from "express";
import {
  searchDoctors,
  availableTimeSlots,
  bookAppointment,
  cancelAppointment,
  viewPrescriptions,
  prescriptionPdf,
  getUpcomingAppointments,
  getPastAppointments,
  fetchAllDoctors,
  cityRooms,
  bookDirectAppointment,
  getAllPatientAppointments,
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/patient.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isPatient } from "../utils/helper";

const router = express.Router();

router.get("/search-doctors", isAuthenticated, isPatient, searchDoctors);
router.get(
  "/:doctorId/timeSlots",
  isAuthenticated,
  isPatient,
  availableTimeSlots
);
router.post("/book-appointment", isAuthenticated, isPatient, bookAppointment);

router.get(
  "/upcoming-appointments",
  isAuthenticated,
  isPatient,
  getUpcomingAppointments
);
router.get(
  "/past-appointments",
  isAuthenticated,
  isPatient,
  getPastAppointments
);

router.patch(
  "/cancel-appointment/:appointmentId",
  isAuthenticated,
  isPatient,
  cancelAppointment as any
);

router.get(
  "/view-Prescriptions",
  isAuthenticated,
  isPatient,
  viewPrescriptions as any
);
router.get("/prescription-pdf/:id", prescriptionPdf as any);
router.get("/fetchAllDoctors", fetchAllDoctors);
router.get("/city-rooms", isAuthenticated, isPatient, cityRooms as any);

// New direct appointment booking routes
router.post("/book-direct-appointment", isAuthenticated, isPatient, bookDirectAppointment);
router.get("/all-appointments", isAuthenticated, isPatient, getAllPatientAppointments);

// Notification routes
router.get("/notifications", isAuthenticated, isPatient, getPatientNotifications);
router.patch("/notifications/:notificationId/read", isAuthenticated, isPatient, markNotificationAsRead);
router.patch("/notifications/mark-all-read", isAuthenticated, isPatient, markAllNotificationsAsRead);

export default router;
