import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary";
import multer from "multer";

const storage = new CloudinaryStorage({
    cloudinary,
    params : async () => {
        return {
            folder: 'careXpert_profile_pictures',
            allowed_formats: ['jpg', 'jpeg', 'png'],
            transformation: [{ width: 500, height: 500, crop: 'limit' }],
        }
    }
});

const upload = multer({storage});

export default upload;