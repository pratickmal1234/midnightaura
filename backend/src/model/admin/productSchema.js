// models/ProductModel.js

import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    // Primary Key
    productId: {
      type: String,
      unique: true,
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Men",
        "Women",
        "Kids",
        "Earrings",
        "Necklaces",
        "Oversized",
        "Hoodies",
      ],
    },

    subCategory: {
      type: String,
      default: null,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    finalPrice: {
      type: Number,
      default: 0,
    },

    estimatedDelivery: {
      type: String,
      enum: [
        "Tomorrow",
        "Within 3 Days",
        "Within 5 Days",
        "Within 10 Days",
      ],
      default: "Within 3 Days",
    },

    totalStock: {
      type: Number,
      default: 0,
    },

    stockBySize: {
      s: {
        type: Number,
        default: 0,
      },

      m: {
        type: Number,
        default: 0,
      },

      l: {
        type: Number,
        default: 0,
      },

      xl: {
        type: Number,
        default: 0,
      },

      xxl: {
        type: Number,
        default: 0,
      },
    },

    productColor: {
      name: {
        type: String,
        default: "",
      },

      hex: {
        type: String,
        default: "",
      },
    },

    // only image paths
    productImages: [
      {
        type: String,
        required: true,
      },
    ],

    status: {
      type: String,
      enum: ["Active", "Low", "Out"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Product", productSchema);