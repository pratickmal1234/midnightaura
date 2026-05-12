import express from "express"
import { loginSchema, registerSchema, validateUser } from "../Validation/UserValidation.js"
import { forgotPassword, login, Logout, Register, resetPassword, verifyOtp } from "../controller/user/userControllers.js"
import { verifyUser } from "../middleware/verifyUser.js"

const userRout = express.Router()

userRout.post("/register", validateUser(registerSchema), Register)
userRout.post("/login", validateUser(loginSchema), login)
userRout.delete("/logout", verifyUser, Logout)

userRout.post("/forgotPassword", forgotPassword)
userRout.post("/verifyOtp", verifyOtp)
userRout.post("/resetPassword", resetPassword)








export default userRout