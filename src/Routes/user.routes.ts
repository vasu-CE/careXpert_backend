import express from 'express'
import { doctorProfile, login, logout, signup, userProfile } from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';



const router = express.Router();

router.post('/signup' , signup);
router.post('/login' , login);
router.post('/logout' , isAuthenticated , logout);


router.get("/patient/profile/:id" , isAuthenticated , userProfile);
router.get("/doctor/profile/:id" , isAuthenticated , doctorProfile);

export default router;