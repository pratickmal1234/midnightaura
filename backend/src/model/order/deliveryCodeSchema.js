import mongoose from "mongoose";

const deliveryCodeSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },

    code: {
      type: String,
      required: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const DeliveryCode = mongoose.model(
  "DeliveryCode",
  deliveryCodeSchema
);

export default DeliveryCode;