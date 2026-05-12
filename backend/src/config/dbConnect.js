import mongoose from "mongoose";
import dotenv from "dotenv/config"

export async function dbConnect() {
    try {
        await mongoose.connect(process.env.URL)
        console.log("db is connected");
        
        
    } catch (error) {
        console.log("db is not connected",error);
        
    }
    
}