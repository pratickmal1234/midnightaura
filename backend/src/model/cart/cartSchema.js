// models/Cart.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const CartItemSchema = new mongoose.Schema(
  {
    cartId: {
  type: String,
  default: () => "CRT" + uuidv4().split("-")[0].toUpperCase(),
  unique: true,
  index: true,
},

    customerId: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },

    productId: {
      type:String,
      ref: "Product",
      required: true,
    },

    size: {
      type: String,
      enum: ["S", "M", "L", "XL", "XXL", null],
      default: null,             // null for products that have no size variants
    },

    quantity: {
      type: Number,
      default: 1,
      min: [1, "Quantity must be at least 1"],
    },

    addedAt: {
      type: Date,
      default: Date.now,         // full timestamp stored automatically
    },
  },
  {
    timestamps: true,            // also adds createdAt + updatedAt
    versionKey: false,
  }
);

// Compound index: one cart entry per customer+product+size combo
// So adding the same item again just bumps quantity instead of duplicating
CartItemSchema.index({ customerId: 1, productId: 1, size: 1 }, { unique: true });

const CartItem = mongoose.model("CartItem", CartItemSchema);
export default CartItem;