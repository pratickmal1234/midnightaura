// model/user/userAddress.js
import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    lat:   { type: Number, required: true },
    lng:   { type: Number, required: true },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const userAddressSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userEmail:    { type: String, required: true, index: true },
    customerId:   { type: String },
    username:     { type: String },

    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    city:         { type: String, default: "" },
    district:     { type: String, default: "" },
    state:        { type: String, default: "" },
    pincode:      { type: String, default: "" },
    country:      { type: String, default: "India" },

    // GPS pin set from the map picker — null until user sets it
    location:     { type: locationSchema, default: null },
  },
  { timestamps: true }
);

const UserAddress = mongoose.model("UserAddress", userAddressSchema);
export default UserAddress;