// models/userAddress.model.js
import mongoose from "mongoose";

const userAddressSchema = new mongoose.Schema(
  {
    // ── Reference to the user ─────────────────────────────────────
    userEmail: {
      type: String,
      required: true,
      ref: "User",       // logical reference for populate via email
      unique: true,      // one address doc per user (1-to-1)
      lowercase: true,
      trim: true,
    },

    // ── Address fields (empty by default) ────────────────────────
    addressLine1: {
      type: String,
      default: "",
    },
    addressLine2: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
     district: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    pincode: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "India",
    },
  },
  { timestamps: true }
);

export default mongoose.model("UserAddress", userAddressSchema);