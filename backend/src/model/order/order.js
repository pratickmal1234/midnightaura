// models/order/order.js  (updated — adds RETURNED to orderState enum)
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      default: () => "ORD" + uuidv4().split("-")[0].toUpperCase(),
      unique: true,
    },
    productId: {
      type: String,
      ref: "Product",
      required: true,
    },
    customerId: {
      type: String,
      ref: "User",
      required: true,
    },
    productPrice: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      required: true,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    size: {
      type: String,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    payMethod: {
      type: String,
      enum: ["COD", "CARD", "UPI"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    orderState: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",   // ← NEW
      ],
      default: "PLACED",
    },
    // ── Timestamps for each state transition ──────────────────────────────────
    confirmedAt:        { type: Date, default: null },
    shippedAt:          { type: Date, default: null },
    deliveredAt:        { type: Date, default: null },
    cancelledAt:        { type: Date, default: null },
    cancellationReason: { type: String, default: null },
    returnedAt:         { type: Date, default: null },   // ← NEW
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Order", OrderSchema);