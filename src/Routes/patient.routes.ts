import express, { Router } from 'express'
import {searchDoctors,availableTimeSlots,bookAppointment,getPatientAppointments} from '../controllers/patient.controller'
import { isAuthenticated } from '../middlewares/auth.middleware';
import { isPatient } from '../utils/helper';


const router = express.Router();


router.get("/search-doctors",isAuthenticated,isPatient,searchDoctors);
router.get("/:doctorId/timeSlots",isAuthenticated,isPatient,availableTimeSlots);
router.post("/book-appointment",isAuthenticated,isPatient, bookAppointment);
router.get("/my-appointments",isAuthenticated,isPatient,getPatientAppointments);


export default router;