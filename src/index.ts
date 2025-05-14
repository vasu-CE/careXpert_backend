import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './Routes/index'; 
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Use Routes
app.use('/api', routes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
