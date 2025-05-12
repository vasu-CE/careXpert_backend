import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import prisma from "../utils/prismClient";
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";

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

const signup = async (req:any , res:any) => {
    const {name ,email , password , role} = req.body;
    try{

        if([name ,email , password].some((field) => field?.trim() === '')) {   
            return res.json(new ApiError(400 , "All field required"));
        }

        const existingUser = await prisma.user.findUnique({
            where : {email}
        });

        if(existingUser){
            return res.status(409).json(new ApiError(409 , "User already exist"));
        }

        const hashedPassword = await bcrypt.hash(password , 10)
        const user = await prisma.user.create({
            data : {
                name,
                email,
                password : hashedPassword,
                role,
                refreshToken : ""
            }
        })

        return res.status(200).json(
            new ApiResponse(200 , user , "Signup successfully")
        )
    }catch(err){
        return res.status(500).json(new ApiError(500 , "Internal server error"));
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