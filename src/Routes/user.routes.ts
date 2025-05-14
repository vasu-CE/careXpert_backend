import express from 'express'
import { login, logout, signup , searchDoctors,availableTimeSlots,bookAppointment,getPatientAppointments} from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { isPatient } from '../utils/helper';


const router = express.Router();

router.post('/signup' , signup);
router.post('/login' , login);
router.post('/logout' , isAuthenticated , logout);
router.get("/search",isPatient,searchDoctors);
router.get("/:doctorId/timeSlots", isPatient,availableTimeSlots);
router.post("/book", isPatient, bookAppointment);
router.get("/my-appointments", isAuthenticated, getPatientAppointments);


export default router;