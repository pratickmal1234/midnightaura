// ── ADD THESE IMPORTS at the top of userControllers.js ──────────────
// import UserDiscount from "../../model/user/userDiscount.js";

import UserDiscount from "../../model/user/userDiscount.js";

// ── Wheel probabilities (kept in sync with frontend SEGMENTS) ──────
// Source weights requested: 50%→1, 15%→10, 10%→20, 5%→60, NO DISCOUNT→25
// (these summed to 116, so they're normalized to sum to 100 below).
// This table isn't used to pick the result (the frontend already rolled
// the result before calling this endpoint) — it's kept here purely as
// the source of truth / documentation so backend and frontend agree on
// what the odds are supposed to be, and so a future server-side-authoritative
// picker (recommended — see note in saveDiscount) can reuse it directly.
export const DISCOUNT_PROBABILITIES = {
  "50% OFF": 0.0086,        // 0.86%
  "15% OFF": 0.0862,        // 8.62%
  "10% OFF": 0.1724,        // 17.24%
  "5% OFF": 0.5172,         // 51.72%
  "NO DISCOUNT": 0.2155,    // 21.55%
};

// ── Helper: parse discount percent from label ──────────────────────
function parseDiscountValue(label) {
  if (label === "NO DISCOUNT") return 0;
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Helper: generate unique discount ID ───────────────────────────
function genDiscountId(label) {
  const tag  = label === "NO DISCOUNT" ? "NONE" : label.replace("% OFF", "").replace(/\s+/g, "");
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SAVE${tag}-${rand}`;
}

// ── Save Discount Voucher ──────────────────────────────────────────
// POST /user/saveDiscount
// Body: { userEmail, customerId, discountLabel }
//
// NOTE: "NO DISCOUNT" results are now stored too, so the spin-lock /
// history logic on the frontend has a real record to key off of instead
// of silently dropping losing spins. A stored NO DISCOUNT voucher has
// discountValue: 0 and is never usable at checkout, but it still counts
// toward "you already spun this week" the same way a winning voucher does.
export const saveDiscount = async (req, res) => {
  try {
    const { userEmail, customerId, discountLabel } = req.body;

    if (!userEmail || !customerId || !discountLabel) {
      return res.status(400).json({
        success: false,
        message: "userEmail, customerId, and discountLabel are required.",
      });
    }

    // Check if user already has a voucher issued this week — prevents
    // duplicate saves on retry/double-click, and enforces "one spin per week"
    // regardless of whether that spin was a win or a NO DISCOUNT result.
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

    // Annotate each with live validity. NO DISCOUNT vouchers (discountValue
    // 0 / discountLabel "NO DISCOUNT") are never "valid" for redemption,
    // even within their window, since there's nothing to redeem.
    const annotated = discounts.map((d) => ({
      ...d,
      isValid:
        d.discountLabel !== "NO DISCOUNT" &&
        !d.isUsed &&
        new Date(d.expiresAt) > now,
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
    if (voucher.discountLabel === "NO DISCOUNT") {
      return res.status(400).json({ success: false, message: "This voucher has no discount to apply." });
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