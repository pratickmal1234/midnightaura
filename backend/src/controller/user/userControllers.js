import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

import dotenv from "dotenv/config"

import { otpSent } from "../../sendEmail/otpSend.js"
import User from "../../model/user/userSchema.js"
import UserAddress from "../../model/user/userAddress.js"



export const Register = async (req, res) => {
    try {
        const { username, email, password } = req.body
        console.log(req.body);

        // ── Check if user already exists ──────────────────────────
        const existing = await User.findOne({ email })
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "user already existing"
            })
        }

        // ── Hash password & create user ───────────────────────────
        const hash = await bcrypt.hash(password, 10)
        const user = await User.create({ username, email, password: hash })

        // ── Generate JWT & save token ─────────────────────────────
        const token = jwt.sign({ _id: user.id }, process.env.USER_JWT_SECRET, {
            expiresIn: "2d"
        })
        user.token = token
        await user.save()

        // ── Create empty address doc for this user ────────────────
        const address = await UserAddress.create({ userEmail: email })

        console.log(user, address);

        return res.status(201).json({
            success: true,
            message: "user registered successfully",
            user,
            address
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}
// controllers/profile.controller.js
export const UpdateProfile = async (req, res) => {
  try {
    const { username, phone, altPhone, gender, email } = req.body;
    console.log("UpdateProfile body:", req.body);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const allowedUpdates = {};
    // ✅ check !== undefined so even "" (clearing a field) is saved
    if (username !== undefined) allowedUpdates.username = username.trim();
    if (phone    !== undefined) allowedUpdates.phone    = phone.trim();
    if (altPhone !== undefined) allowedUpdates.altPhone = altPhone.trim();
    if (gender   !== undefined) {
      const validGenders = ["Male", "Female", "Prefer not to say", ""];
      if (!validGenders.includes(gender)) {
        return res.status(400).json({
          success: false,
          message: "Invalid gender value",
        });
      }
      allowedUpdates.gender = gender;
    }

    console.log("allowedUpdates:", allowedUpdates);

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update",
      });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select("-password -token");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });

  } catch (error) {
    console.log("UpdateProfile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const UpdateAddress = async (req, res) => {
  try {
    const { email, addressLine1, addressLine2, city, district ,state, pincode, country } = req.body;

    const allowedUpdates = {};
    if (addressLine1 !== undefined) allowedUpdates.addressLine1 = addressLine1.trim();
    if (addressLine2 !== undefined) allowedUpdates.addressLine2 = addressLine2.trim();
    if (city         !== undefined) allowedUpdates.city         = city.trim();
    if (district         !== undefined) allowedUpdates.district         = district.trim();
    if (state        !== undefined) allowedUpdates.state        = state.trim();
    if (pincode      !== undefined) allowedUpdates.pincode      = pincode.trim();
    if (country      !== undefined) allowedUpdates.country      = country.trim();

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update",
      });
    }

    const updatedAddress = await UserAddress.findOneAndUpdate(
      { userEmail: email },
      { $set: allowedUpdates },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: updatedAddress,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const getProfile = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("getProfile called with email:", email); // ← add this

    const user = await User.findOne({ email }).select("-password -token");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ fixed field name
    const address = await UserAddress.findOne({ userEmail: email }) ?? {};

    return res.status(200).json({ success: true, user, address });

  } catch (error) {
    console.log("getProfile error:", error); // ← and this
    return res.status(500).json({ success: false, message: error.message });
  }
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body
        const existing = await User.findOne({ email })
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

    const user = await User.findById(req.userId);

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


        const user = await User.findOne({ email });

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
    await User.findOneAndUpdate({ email }, { password: hash });

    res.clearCookie("fp_verified");
    res.clearCookie("fp_email");

    res.json({ message: "Password reset successful" });
};










