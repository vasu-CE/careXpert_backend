import express from "express";
import {
  processSymptoms,
  getChatHistory,
  getChatById,
} from "../controllers/ai-chat.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// POST /api/ai-chat/process - Process user symptoms and get AI analysis
router.post("/process", processSymptoms as any);

// GET /api/ai-chat/history - Get user's AI chat history
router.get("/history", getChatHistory as any);

// GET /api/ai-chat/:chatId - Get a specific AI chat by ID
router.get("/:chatId", getChatById as any);

export default router;
