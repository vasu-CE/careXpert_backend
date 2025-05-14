import { Response } from "express";
import { UserRequest } from "../utils/helper";
import { PrismaClient } from "@prisma/client";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const prisma = new PrismaClient();





export const viewDoctorAppointment = async(
  req:UserRequest,
  res:Response
):Promise<void> =>{

}