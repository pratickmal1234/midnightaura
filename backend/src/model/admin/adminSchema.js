import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    adminName: {
        type: String, required: true
    },
    emailId: {
        required: true,
        type: String,
        unique: true,
        trim: true,
        lowercase: true,
        immutable: true
    },
    password: {
        type: String, required: true
    }
},{timestamps:true})
export default mongoose.model("admin",adminSchema)