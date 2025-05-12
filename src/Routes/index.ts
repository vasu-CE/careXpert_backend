import express from 'express';
import userRoute from "./user.route";
//import individual routes here ---

const router = express.Router();

//group all routes here---
router.use('/user' , userRoute);


export default router;
