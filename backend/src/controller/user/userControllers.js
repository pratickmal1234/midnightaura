import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

import dotenv from "dotenv/config"

import { otpSent } from "../../sendEmail/otpSend.js"
import userSchema from "../../model/user/userSchema.js"




export const Register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body
        const existing = await userSchema.findOne({ email })
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "user already existing"
            })
        }
        const hash = await bcrypt.hash(password, 10)
        const user = await userSchema.create({ firstName, lastName, email, password: hash })

        const token = jwt.sign({ _id: user.id }, process.env.USER_JWT_SECRET, {
            expiresIn: "2d"
        })


        user.token = token
        await user.save()

console.log(user);

        if (user) {
            return res.status(201).json({
                success: true,
                message: "user register successfuly",
                user
            })
        } else {
            return res.status(400).json({
                success: false,
                message: "user not register try again"
            })
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


export const login = async (req, res) => {
    try {
        const { email, password } = req.body
        const existing = await userSchema.findOne({ email })
        if (!existing) {
            return res.status(400).json({
                success: false,
                message: "user not existing"
            })
        }

        const comparePassword = await bcrypt.compare(password, existing.password)
        if (!comparePassword) {
            return res.status(400).json({
                success: false,
                message: "password not match"
            })
        } else {


            const accessToken = jwt.sign(
                { id: existing._id },
                process.env.USER_JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );
            const refreshToken = jwt.sign(
                { id: existing._id },
                process.env.USER_JWT_SECRET,
                { expiresIn: "30d" }
            );

            existing.isLoged = true
            await existing.save()

            res.cookie("userToken", accessToken, { httpOnly: true, sameSite: "lax", secure: false });

            return res.status(200).json({
                success: true,
                message: "user login successfuly",
                accessToken: accessToken,
                refreshToken: refreshToken,
                user: {
                    _id: existing._id,
                    firstName: existing.firstName,
                    email: existing.email,
                }
            })
        } 

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


export const Logout = async (req, res) => {
  try {

    const user = await userSchema.findById(req.userId);

    if (user) {

      user.isLoged = false;

      await user.save();

      res.clearCookie("userToken", {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
      });

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });

    } else {

      return res.status(404).json({
        success: false,
        message: "User had no session",
      });

    }

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};




export const forgotPassword = async (req, res) => {
    try {

        const { email } = req.body;
        // console.log(email);


        const user = await userSchema.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);

        res.cookie("fp_otp", otp.toString(), {
            httpOnly: true,
            maxAge: 10 * 60 * 1000,
            sameSite: "lax"
        });

        res.cookie("fp_email", email, {
            httpOnly: true,
            maxAge: 10 * 60 * 1000
        });

        await otpSent(otp, email);

        res.json({ message: "OTP sent" });

    } catch (error) {

        // console.log("FORGOT PASSWORD ERROR 👉", error);

        res.status(500).json({
            message: error.message
        });
    }
};

export const verifyOtp = (req, res) => {
    const { otp } = req.body;
    const cookieOtp = req.cookies.fp_otp;

    // convert to string
    if (!cookieOtp || cookieOtp !== otp.toString()) {
        return res.status(400).json({ message: "Invalid OTP" });
    }

    res.clearCookie("fp_otp");

    res.cookie("fp_verified", "true", {
        httpOnly: true,
        maxAge: 10 * 60 * 1000
    });

    res.json({ message: "OTP verified" });
};



export const resetPassword = async (req, res) => {
    if (req.cookies.fp_verified !== "true") {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const { password } = req.body;
    const email = req.cookies.fp_email;

    const hash = await bcrypt.hash(password, 10);
    await userSchema.findOneAndUpdate({ email }, { password: hash });

    res.clearCookie("fp_verified");
    res.clearCookie("fp_email");

    res.json({ message: "Password reset successful" });
};










