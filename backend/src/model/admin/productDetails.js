// models/ProductDetailsModel.js

import mongoose from "mongoose";

const productDetailsSchema = new mongoose.Schema(
  {
    // Relation with Product table
    productId: {
      type: String,
      required: true,
      unique: true,
      ref: "Product",
    },

    details: [
      {
        field: {
          type: String,
          required: true,
        },

        value: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "ProductDetails",
  productDetailsSchema
);