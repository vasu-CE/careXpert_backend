import express, { Router } from 'express'
import {searchDoctors,availableTimeSlots,bookAppointment, cancelAppointment, viewPrescriptions, prescriptionPdf, getUpcomingAppointments, getPastAppointments, fetchAllDoctors} from '../controllers/patient.controller'
import { isAuthenticated } from '../middlewares/auth.middleware';
import { isPatient } from '../utils/helper';


const router = express.Router();


router.get("/search-doctors",isAuthenticated,isPatient,searchDoctors);
router.get("/:doctorId/timeSlots",isAuthenticated,isPatient,availableTimeSlots);
router.post("/book-appointment",isAuthenticated,isPatient, bookAppointment);

router.get("/upcoming-appointments",isAuthenticated,isPatient,getUpcomingAppointments);
router.get("/past-appointments",isAuthenticated,isPatient,getPastAppointments);


router.patch("/cancel-appointment/:appointmentId",isAuthenticated,isPatient,cancelAppointment);

router.get("/view-Prescriptions",isAuthenticated,isPatient,viewPrescriptions);
router.get("/prescription-pdf/:id" , prescriptionPdf);
router.get("/fetchAllDoctors",fetchAllDoctors);


export default router;