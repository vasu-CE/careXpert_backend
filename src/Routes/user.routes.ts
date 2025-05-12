import express from 'express'
import { login, logout, signup } from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/signup' , signup);
router.post('/login' , login);
router.post('/logout' , isAuthenticated , logout);

export default router;


