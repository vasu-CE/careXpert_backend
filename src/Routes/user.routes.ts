import express from "express";
import {
  doctorProfile,
  login,
  logout,
  signup,
  adminSignup,
  updateDoctorProfile,
  updatePatientProfile,
  userProfile,
  getAuthenticatedUserProfile,
} from "../controllers/user.controller";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { isDoctor, isPatient } from "../utils/helper";
import {upload} from "../middlewares/upload";

const router = express.Router();

router.post("/signup", signup);
router.post("/admin-signup", adminSignup);
router.post("/login", login);
router.post("/logout", isAuthenticated, logout);

router.get("/patient/profile/:id", isAuthenticated, userProfile);
router.get("/doctor/profile/:id", isAuthenticated, doctorProfile);

router.put(
  "/update-patient",
  isAuthenticated,
  isPatient,
  upload.single("profilePicture"),
  updatePatientProfile
);
router.put(
  "/update-doctor",
  isAuthenticated,
  isDoctor,
  upload.single("profilePicture"),
  updateDoctorProfile
);

router.get(
  "/authenticated-profile",
  isAuthenticated,
  getAuthenticatedUserProfile
);

export default router;
