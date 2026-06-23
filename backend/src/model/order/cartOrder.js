// models/order/cartOrderSchema.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * CartOrderItem — one line-item inside a cart order.
 * Mirrors the cart structure: productId + size + quantity + prices.
 */
const CartOrderItemSchema = new mongoose.Schema(
  {
    productId:     { type: String, ref: "Product", required: true },
    productName:   { type: String, default: "" },          // denormalised snapshot
    productImage:  { type: String, default: null },         // first image snapshot
    size:          { type: String, default: null },
    quantity:      { type: Number, required: true, min: 1, max: 10 },
    unitPrice:     { type: Number, required: true },        // finalPrice at order time
    mrp:           { type: Number, required: true },        // original price at order time
    discount:      { type: Number, default: 0 },            // % discount at order time
    lineTotal:     { type: Number, required: true },        // unitPrice × quantity
  },
  { _id: false }
);

const CartOrderSchema = new mongoose.Schema(
  {
    cartOrderId: {
      type: String,
      default: () => "CORD" + uuidv4().split("-")[0].toUpperCase(),
      unique: true,
    },
    customerId: { type: String, ref: "User", required: true },

    // ── Line items ────────────────────────────────────────────────────────────
    items: { type: [CartOrderItemSchema], required: true },

    // ── Price breakdown ───────────────────────────────────────────────────────
    subtotal:       { type: Number, required: true },   // sum of all lineTotals (at finalPrice)
    mrpTotal:       { type: Number, required: true },   // sum of all (mrp × qty)
    totalDiscount:  { type: Number, default: 0 },       // mrpTotal − subtotal
    voucherId:      { type: String, default: null },
    voucherDiscount:{ type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    totalPrice:     { type: Number, required: true },   // final amount paid

    // ── Payment ───────────────────────────────────────────────────────────────
    payMethod:     { type: String, enum: ["COD", "CARD", "UPI"], required: true },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING" },

    // ── Order lifecycle ───────────────────────────────────────────────────────
    orderState: {
      type: String,
      enum: ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"],
      default: "PLACED",
    },

    // ── State timestamps ──────────────────────────────────────────────────────
    confirmedAt:        { type: Date, default: null },
    shippedAt:          { type: Date, default: null },
    deliveredAt:        { type: Date, default: null },
    cancelledAt:        { type: Date, default: null },
    cancellationReason: { type: String, default: null },
    returnedAt:         { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("CartOrder", CartOrderSchema);