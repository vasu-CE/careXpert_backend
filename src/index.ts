import express from 'express'
import dotenv from 'dotenv'

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();

app.get('/' , (req , res) => {
    res.send("hello world...")
})

app.listen(PORT , () => {
    console.log(`http://localhost:${PORT}`);
})