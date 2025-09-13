import express from "express";
import { getRoomMessages, getDmMessages, getToken } from "../controllers/chat.controller";
// You might want to add authentication middleware here later
// import { isAuthenticated } from '../middlewares/auth.middleware';

const router = express.Router();

// Route to get messages for a specific room (city chat)
// Example: GET /api/chat/room/New York
router.get("/room/:city", getRoomMessages);

// Route to get messages for a specific DM room
// Example: GET /api/chat/dm/DM_patient1_doctor1
router.get("/dm/:roomId", getDmMessages);

router.post('/get-token' , getToken);

export default router;
