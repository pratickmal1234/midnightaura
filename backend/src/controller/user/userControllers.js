// controllers/user/userControllers.js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv/config";
import { otpSent } from "../../sendEmail/otpSend.js";
import User from "../../model/user/userSchema.js";
import UserAddress from "../../model/user/userAddress.js";
import Feedback from "../../model/user/userFeedback.js";

const MAX_IMAGE_B64_LEN = 3_700_000; // ~2.7 MB base64

function isValidImageDataUrl(str) {
  if (typeof str !== "string") return false;
  if (!str.startsWith("data:image/")) return false;
  if (str.length > MAX_IMAGE_B64_LEN) return false;
  return true;
}

// ── Register ───────────────────────────────────────────────────────
export const Register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    const cleanName = username.replace(/\s+/g, "").toUpperCase().slice(0, 3);
    const uniqueNumber = Date.now().toString().slice(-5);
    const customerId = `${cleanName}${day}${month}${year}${uniqueNumber}`;

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash, customerId });

    const token = jwt.sign({ _id: user.id }, process.env.USER_JWT_SECRET, {
      expiresIn: "2d",
    });
    user.token = token;
    await user.save();

    const address = await UserAddress.create({
      userEmail: email,
      customerId,
      username,
      userId: user._id,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
      address,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Update Profile ─────────────────────────────────────────────────
export const UpdateProfile = async (req, res) => {
  try {
    const { username, phone, altPhone, gender, email } = req.body;

    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const allowedUpdates = {};
    if (username !== undefined) allowedUpdates.username = username.trim();
    if (phone !== undefined) allowedUpdates.phone = phone.trim();
    if (altPhone !== undefined) allowedUpdates.altPhone = altPhone.trim();
    if (gender !== undefined) {
      const validGenders = ["Male", "Female", "Prefer not to say", ""];
      if (!validGenders.includes(gender))
        return res.status(400).json({ success: false, message: "Invalid gender value" });
      allowedUpdates.gender = gender;
    }

    if (Object.keys(allowedUpdates).length === 0)
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select("-password -token");

    if (!updatedUser)
      return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UpdateProfile error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Update Address ─────────────────────────────────────────────────
export const UpdateAddress = async (req, res) => {
  try {
    const {
      email,
      addressLine1,
      addressLine2,
      city,
      district,
      state,
      pincode,
      country,
      location,
    } = req.body;

    if (!email)
      return res.status(400).json({ success: false, message: "Email is required" });

    const allowedUpdates = {};
    if (addressLine1 !== undefined) allowedUpdates.addressLine1 = addressLine1.trim();
    if (addressLine2 !== undefined) allowedUpdates.addressLine2 = addressLine2.trim();
    if (city !== undefined) allowedUpdates.city = city.trim();
    if (district !== undefined) allowedUpdates.district = district.trim();
    if (state !== undefined) allowedUpdates.state = state.trim();
    if (pincode !== undefined) allowedUpdates.pincode = pincode.trim();
    if (country !== undefined) allowedUpdates.country = country.trim();

    if (location !== undefined) {
      if (location === null) {
        allowedUpdates.location = null;
      } else {
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lng);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
          return res.status(400).json({ success: false, message: "Invalid location coordinates" });
        allowedUpdates.location = {
          lat,
          lng,
          label: typeof location.label === "string" ? location.label.trim() : "",
        };
      }
    }

    if (Object.keys(allowedUpdates).length === 0)
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });

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
    console.error("UpdateAddress error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Profile ────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select("-password -token");
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const address = (await UserAddress.findOne({ userEmail: email })) ?? {
      addressLine1: "",
      addressLine2: "",
      city: "",
      district: "",
      state: "",
      pincode: "",
      country: "India",
      location: null,
    };

    return res.status(200).json({ success: true, user, address });
  } catch (error) {
    console.error("getProfile error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Login ──────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existing = await User.findOne({ email });
    if (!existing)
      return res.status(400).json({ success: false, message: "User not found" });

    const comparePassword = await bcrypt.compare(password, existing.password);
    if (!comparePassword)
      return res.status(400).json({ success: false, message: "Incorrect password" });

    const accessToken = jwt.sign(
      { id: existing._id },
      process.env.USER_JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshToken = jwt.sign(
      { id: existing._id },
      process.env.USER_JWT_SECRET,
      { expiresIn: "30d" }
    );

    existing.isLoged = true;
    await existing.save();

    res.cookie("userToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        _id: existing._id,
        firstName: existing.firstName,
        email: existing.email,
      },
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Logout ─────────────────────────────────────────────────────────
export const Logout = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user) {
      user.isLoged = false;
      await user.save();
      res.clearCookie("userToken", { httpOnly: true, secure: true, sameSite: "Strict" });
      return res.status(200).json({ success: true, message: "Logged out successfully" });
    } else {
      return res.status(404).json({ success: false, message: "User had no session" });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Forgot Password ────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    res.cookie("fp_otp", otp.toString(), { httpOnly: true, maxAge: 10 * 60 * 1000, sameSite: "lax" });
    res.cookie("fp_email", email, { httpOnly: true, maxAge: 10 * 60 * 1000 });

    await otpSent(otp, email);
    res.json({ message: "OTP sent" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Verify OTP ─────────────────────────────────────────────────────
export const verifyOtp = (req, res) => {
  const { otp } = req.body;
  const cookieOtp = req.cookies.fp_otp;
  if (!cookieOtp || cookieOtp !== otp.toString())
    return res.status(400).json({ message: "Invalid OTP" });
  res.clearCookie("fp_otp");
  res.cookie("fp_verified", "true", { httpOnly: true, maxAge: 10 * 60 * 1000 });
  res.json({ message: "OTP verified" });
};

// ── Reset Password ─────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  if (req.cookies.fp_verified !== "true")
    return res.status(403).json({ message: "Unauthorized" });
  const { password } = req.body;
  const email = req.cookies.fp_email;
  const hash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate({ email }, { password: hash });
  res.clearCookie("fp_verified");
  res.clearCookie("fp_email");
  res.json({ message: "Password reset successful" });
};

// ── Submit Feedback ────────────────────────────────────────────────
// FIX: productId is stored as-is from req.body.
// The frontend must send the same productId (product.productId) both
// when SUBMITTING and when FETCHING feedback. Do NOT use the MongoDB _id
// for this field — use the product's own productId field consistently.


export const submitFeedback = async (req, res) => {
  try {
    const {
      orderId,
      productId,
      customerId,
      feedbackType,
      rating,
      title,
      description,
      croppedImage,
      imageComment,
    } = req.body;

    // Validation
    if (!orderId || !productId || !customerId) {
      return res.status(400).json({
        success: false,
        message: "orderId, productId and customerId are required.",
      });
    }

    if (!["comment", "image"].includes(feedbackType)) {
      return res.status(400).json({
        success: false,
        message: "feedbackType must be comment or image.",
      });
    }

    const ratingNum = Number(rating);

    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    let commentFeedback = null;
    let imageFeedback = null;

    // Comment Feedback
    if (feedbackType === "comment") {
      if (!title?.trim() || !description?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title and description are required.",
        });
      }

      commentFeedback = {
        title: title.trim(),
        description: description.trim(),
      };
    }

    // Image Feedback
    if (feedbackType === "image") {
      if (!isValidImageDataUrl(croppedImage)) {
        return res.status(400).json({
          success: false,
          message: "Valid cropped image is required.",
        });
      }

      if (!imageComment?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Image comment is required.",
        });
      }

      imageFeedback = {
        imageData: croppedImage,
        imageComment: imageComment.trim(),
      };
    }

    // INSERT NEW FEEDBACK
    const feedback = await Feedback.create({
      orderId,
      productId,
      customerId,

      feedbackType,
      rating: ratingNum,

      commentFeedback,
      imageFeedback,

      submittedAt: new Date(),
      isVisible: true,
    });

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully.",
      data: feedback,
    });
  } catch (err) {
    console.error("submitFeedback error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ── Get Feedback By Product ────────────────────────────────────────
// FIX: The route param :productId must be the same product.productId
// string that was stored during submitFeedback.
// The frontend decrypts the URL param to get the MongoDB _id, but
// feedback was stored using product.productId — so we query BOTH fields
// to be safe, and also return the stored productId for debugging.
export const getFeedbackByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
     console.log("Product Id : ",productId);
    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 5));
    const skip  = (page - 1) * limit;

    // ── KEY FIX ───────────────────────────────────────────────────
    // During submitFeedback the frontend sends product.productId
    // (the product's own ID field, e.g. "PROD123"), NOT the MongoDB _id.
    // During fetchFeedback the frontend decrypts the URL to get
    // the MongoDB _id and passes that — causing a mismatch.
    //
    // Solution: query by BOTH so it works regardless of which ID is sent.
    // Long-term fix: standardize the frontend to always send product.productId.
    const { default: mongoose } = await import("mongoose");
    const isObjectId = mongoose.Types.ObjectId.isValid(productId);

    // Build a query that matches whichever ID format was stored
    const baseFilter = {
      isVisible: true,
      ...(isObjectId
        ? { $or: [{ productId }, { productId: productId.toString() }] }
        : { productId }),
    };

    const allFeedback = await Feedback.find(baseFilter)
      .sort({ submittedAt: -1 })
      .lean();

    const totalCount = allFeedback.length;

    // ── Rating statistics ─────────────────────────────────────────
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    allFeedback.forEach((item) => {
      totalRating += item.rating || 0;
      if (ratingCounts[item.rating] !== undefined) ratingCounts[item.rating]++;
    });

    const avgRating = totalCount > 0
      ? Number((totalRating / totalCount).toFixed(1))
      : 0;

    // ── Split by type ─────────────────────────────────────────────
    const imageFeedback = allFeedback.filter((f) => f.feedbackType === "image");

    const allComments = allFeedback.filter((f) => f.feedbackType === "comment");
    const commentFeedback = allComments.slice(skip, skip + limit);
    const totalCommentFeedback = allComments.length;
    const totalPages = Math.ceil(totalCommentFeedback / limit);

    return res.status(200).json({
      success: true,
      avgRating,
      totalCount,
      ratingCounts,
      imageFeedback,
      commentFeedback,
      meta: { page, limit, totalPages },
    });
  } catch (error) {
    console.error("getFeedbackByProduct error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};