import mongoose from "mongoose";

const userDiscountSchema = new mongoose.Schema(
  {
    // Link to the user
    userEmail:  { type: String, required: true, lowercase: true, trim: true, index: true },
    customerId: { type: String, required: true, trim: true },

    // Voucher details
    discountId:    { type: String, required: true, unique: true },   // e.g. SAVE10-AB3XY
    discountLabel: { type: String, required: true },                  // e.g. "10% OFF"
    discountValue: { type: Number, required: true },                  // e.g. 10 (percent)

    // Validity
    issuedAt:  { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },                        // issuedAt + 7 days

    // Status
    isUsed:    { type: Boolean, default: false },
    usedAt:    { type: Date,    default: null },
    isExpired: { type: Boolean, default: false },                     // set by TTL or cron
  },
  { timestamps: true }
);

// Auto-expire: MongoDB TTL index removes the doc after expiresAt
// (optional; keeps collection clean — remove if you want history)
userDiscountSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual: is this voucher still redeemable right now?
userDiscountSchema.virtual("isValid").get(function () {
  return !this.isUsed && new Date() < this.expiresAt;
});

const UserDiscount = mongoose.model("UserDiscount", userDiscountSchema);
export default UserDiscount;