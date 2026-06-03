// models/user.model.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ── Auth fields (required at signup) ──────────────────────────
     username: {
      type: String,
      
    },
    customerId: {
    type: String,
    unique: true,
  },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    isLoged: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
      default: null,
    },

    // ── Personal details (empty by default, filled from profile) ──
   
   
    phone: {
      type: String,
      default: "",
    },
    altPhone: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Prefer not to say", ""],
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);