// ── ADD THESE IMPORTS at the top of userControllers.js ──────────────
// import UserDiscount from "../../model/user/userDiscount.js";

import UserDiscount from "../../model/user/userDiscount.js";

// ── Helper: parse discount percent from label ──────────────────────
function parseDiscountValue(label) {
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Helper: generate unique discount ID ───────────────────────────
function genDiscountId(label) {
  const tag  = label.replace("% OFF", "").replace(/\s+/g, "");
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SAVE${tag}-${rand}`;
}

// ── Save Discount Voucher ──────────────────────────────────────────
// POST /user/saveDiscount
// Body: { userEmail, customerId, discountLabel }
export const saveDiscount = async (req, res) => {
  try {
    const { userEmail, customerId, discountLabel } = req.body;

    if (!userEmail || !customerId || !discountLabel) {
      return res.status(400).json({
        success: false,
        message: "userEmail, customerId, and discountLabel are required.",
      });
    }

    // Don't save "NO DISCOUNT" results
    if (discountLabel === "NO DISCOUNT") {
      return res.status(200).json({
        success: false,
        message: "No discount to save.",
      });
    }

    // Check if user already has an active (unused, non-expired) voucher
    // from this week's spin — prevents duplicate saves on retry
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existing = await UserDiscount.findOne({
      userEmail: userEmail.toLowerCase(),
      issuedAt: { $gte: oneWeekAgo },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Voucher already issued this week.",
        discount: existing,
        alreadyExists: true,
      });
    }

    // Build the voucher
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
    const discountId = genDiscountId(discountLabel);

    const discount = await UserDiscount.create({
      userEmail:     userEmail.toLowerCase().trim(),
      customerId:    customerId.trim(),
      discountId,
      discountLabel,
      discountValue: parseDiscountValue(discountLabel),
      issuedAt:      now,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Discount voucher saved successfully.",
      discount,
    });
  } catch (error) {
    console.error("saveDiscount error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get User's Discounts ───────────────────────────────────────────
// GET /user/discounts?email=xxx@xxx.com
export const getUserDiscounts = async (req, res) => {
  try {
    const email = req.query.email || req.body.email;
    
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const now       = new Date();
    const discounts = await UserDiscount.find({
      userEmail: email.toLowerCase(),
    })
      .sort({ issuedAt: -1 })
      .lean();

    // Annotate each with live validity
    const annotated = discounts.map((d) => ({
      ...d,
      isValid: !d.isUsed && new Date(d.expiresAt) > now,
      timeLeftMs: Math.max(0, new Date(d.expiresAt) - now),
    }));

    return res.status(200).json({
      success:   true,
      discounts: annotated,
    });
  } catch (error) {
    console.error("getUserDiscounts error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Apply / Redeem Discount ────────────────────────────────────────
// PATCH /user/applyDiscount
// Body: { discountId, userEmail }
export const applyDiscount = async (req, res) => {
  try {
    const { discountId, userEmail } = req.body;

    if (!discountId || !userEmail) {
      return res.status(400).json({
        success: false,
        message: "discountId and userEmail are required.",
      });
    }

    const voucher = await UserDiscount.findOne({
      discountId,
      userEmail: userEmail.toLowerCase(),
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found." });
    }
    if (voucher.isUsed) {
      return res.status(400).json({ success: false, message: "Voucher already used." });
    }
    if (new Date() > voucher.expiresAt) {
      return res.status(400).json({ success: false, message: "Voucher has expired." });
    }

    voucher.isUsed = true;
    voucher.usedAt = new Date();
    await voucher.save();

    return res.status(200).json({
      success:  true,
      message:  "Voucher applied successfully.",
      voucher,
      discountValue: voucher.discountValue,
    });
  } catch (error) {
    console.error("applyDiscount error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};