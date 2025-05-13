import jwt from 'jsonwebtoken'
import prisma from '../utils/prismClient';
import { ApiError } from '../utils/ApiError';

export const isAuthenticated = async (req:any , res:any , next:any) => {
    try{
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer " , "");

        if(!token){
            return res.status(401).json(new ApiError(401 , "Unauthorized request"));
        }

        const decodedToken = jwt.verify(token , process.env.ACCESS_TOKEN_SECRET as string);

        if(typeof decodedToken==='object' && decodedToken !== null){
            const user = await prisma.user.findFirst({
                where : {id : decodedToken.userId},
                select : {id : true , name : true , email : true , role : true}
            })

            if(!user){
                return res.status(404).json(new ApiError(404 , "User not found"));
            }

            req.user = user;
            next();
        }else{
            return res.status(401).json(new ApiError(401 , "Invalid token"));
        }

    }catch(err){
        return res.status(500).json(new ApiError(500 , "error in authenticated"));
    }
}