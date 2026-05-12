import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    }, lastName: {
        type: String,
        required: true
    }, email: {
        type: String,
        required: true
    }, password: {
        type: String,
        required: true
    }, isLoged: {
        type: Boolean,
        default: false
    }, token: {
        type: String,
        default: null
    }

}, { timestamps: true })

export default mongoose.model("user", userSchema)