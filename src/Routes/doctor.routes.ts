import { Router } from "express";
import { searchDoctors } from "../controllers/doctor.controller";

const router = Router();

router.get("/search", searchDoctors);


export default router;
