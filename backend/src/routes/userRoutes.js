import express from "express"
import { loginSchema, registerSchema, validateUser } from "../Validation/UserValidation.js"
import { forgotPassword, getFeedbackByProduct, getProfile, login, Logout, Register, resetPassword, submitFeedback, UpdateAddress, UpdateProfile, verifyOtp } from "../controller/user/userControllers.js"
import { verifyUser } from "../middleware/verifyUser.js"

const userRout = express.Router()

userRout.post("/register", validateUser(registerSchema), Register)
userRout.post("/getProfile",getProfile)
userRout.post("/updateProfile",UpdateProfile)
userRout.post("/updateAddress",UpdateAddress)
userRout.post("/submitFeedback",submitFeedback);
userRout.get("/fetchFeedbackByProduct/:productId",getFeedbackByProduct);
userRout.post("/login", validateUser(loginSchema), login)
userRout.delete("/logout", verifyUser, Logout)

userRout.post("/forgotPassword", forgotPassword)
userRout.post("/verifyOtp", verifyOtp)
userRout.post("/resetPassword", resetPassword)








export default userRout