// models/order/returnSchema.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const ReturnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      default: () => "RET" + uuidv4().split("-")[0].toUpperCase(),
      unique: true,
    },
    orderId: {
      type: String,
      ref: "Order",
      required: true,
      unique: true, // one return per order
    },
    customerId: {
      type: String,
      ref: "User",
      required: true,
    },
    productId: {
      type: String,
      ref: "Product",
      required: true,
    },
    returnCause: {
      type: String,
      enum: [
        "Defective / Damaged product",
        "Wrong item delivered",
        "Item not as described",
        "Size / fit issue",
        "Changed my mind",
        "Missing parts or accessories",
        "Other",
      ],
      required: true,
    },
    returnImage: {
      type: String, // base64 data URL or uploaded file path
      default: null,
    },
    returnStatus: {
      type: String,
      enum: ["REQUESTED", "APPROVED", "REJECTED", "PICKED_UP", "REFUNDED"],
      default: "REQUESTED",
    },
    refundAmount: {
      type: Number,
      default: null,
    },
    adminNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Return", ReturnSchema);