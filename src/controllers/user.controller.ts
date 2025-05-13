import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { Role } from "@prisma/client";
import { Request } from "express";
import { hash } from "crypto";

const generateToken =async (userId : string) => {
    try{
        const accessToken = generateAccessToken(userId);
        const refreshToken = generateRefreshToken(userId);

        await prisma.user.update({
            where : {id : userId},
            data : {refreshToken}
        });

        return {accessToken , refreshToken};
    }catch(err){
        throw new ApiError(500 , "Error in generating token");
    }
}

interface UserRequest extends Request{
    body : {
        name : string,
        email : string,
        password : string,
        role : Role,
        clinicLocation : string,
        specialty : string
    }
}

const signup = async (req:UserRequest , res:any)  => {
    const {name ,email , password , role ,specialty , clinicLocation} = req.body;
    
    if([name ,email , password].some((field) => field?.trim() === "")) {   
        return res.status(400).json(new ApiError(400 , "All field required"));
    }

    if(role === "DOCTOR"){
        if(!specialty || !clinicLocation){
            return res.status(400).json(new ApiError(400 , "all field are required"));
        }
    }
    try{
        let existingUser = await prisma.user.findFirst({
            where : {name}
        });

        if(existingUser){
            return res.status(409).json(new ApiError(409 , "Username already taken"));
        }
        existingUser = await prisma.user.findUnique({
            where : {email}
        })
        if(existingUser){
            return res.status(409).json(new ApiError(409 , "User already exist"));
        }

        const hashedPassword = await bcrypt.hash(password , 10)
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data : {
                    name,
                    email,
                    password : hashedPassword,
                    role,
                }
            });

            if(role === "DOCTOR"){
                await prisma.doctor.create({
                    data :{
                        userId : user.id,
                        specialty,
                        clinicLocation
                    }
                })
            }else{
                await prisma.patient.create({
                    data : { userId : user.id}
                });
            }

            return user;
        })
        return res.status(200).json(
            new ApiResponse(200 , {user : result} , "Signup successfully")
        )
    }catch(err){
        console.log(err);
        return res.status(500).json(new ApiError(500 , "Internal server error" , [err]));
    }
}

const login = async (req:any , res:any) => {
    const {name ,email , password , role} = req.body;
    try{
        if(!email && !name){
            return res.json(new ApiError(400 , "username or email is required"));
        }
        if([password , role].some((field) => field.trim() === "")){
            return res.json(new ApiError(400 , "All field required"));
        }

        const user = await prisma.user.findFirst({
            where : {
                OR : [{email} , {name}]
            }
        });

        if(!user){
            return res.status(401).json(new ApiError(401 , "Invalid username or password"));
        }

        const match = await bcrypt.compare(password , user.password);
        if(!match){
            return res.status(401).json(new ApiError(401 , "Invalid username or password"));
        }

        const {accessToken , refreshToken} = await generateToken(user.id);

        // const {password , ...loggedInUser} = user;

        const options = {
            httpOnly : true, //only modified by server
            secure : true
        }
        
        return res.status(200)
        .cookie("accessToken" , accessToken , options)
        .cookie("refreshToken" , refreshToken , options)
        .json(new ApiResponse(200 , user , "Login successfully"));

    }catch(err){
        return res.status(500).json(new ApiError(500 , "Internal server error"));
    }
}

const logout = async (req:any , res:any) => {
    try{
        const id = req.user.id;

        await prisma.user.update({
            where : {id},
            data : {refreshToken : ""}
        });

        const options = {
            httpOnly : true,
            secure : true
        }


        return res.status(200)
        .clearCookie("accessToken" , options)
        .clearCookie("refresToken" , options)
        .json(new ApiResponse(200 , "Logout successfully"));
    }catch(err){
        return res.status(500).json(new ApiError(500 , "internal server error"));
    }
}


export {
    signup,
    login,
    logout
}