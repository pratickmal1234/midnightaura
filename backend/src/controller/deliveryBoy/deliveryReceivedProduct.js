import Product from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";
import fs from "fs";
import path from "path";
import Order from "../../model/order/order.js";
import User from "../../model/user/userSchema.js";
import UserAddress from "../../model/user/userAddress.js";
import DeliveryCode from "../../model/order/deliveryCodeSchema.js";
import deliveryBoySchema from "../../model/delivery/deliveryBoySchema.js";
import jwt from "jsonwebtoken"




export const loginDeliveryBoy = async (req, res) => {
  try {
    const { emailId, password } = req.body;

    if (!emailId || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find delivery boy by email
    const people = await deliveryBoySchema.findOne({ emailId });
    if (!people) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Direct plain-text comparison
    if (password !== people.password) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: people.id, emailId: people.emailId },
      process.env.DELIVERY_JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("deliveryToken", token, { httpOnly: true, sameSite: "strict" });

    return res.status(200).json({ message: "Login Successfully", success: true });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
};









export const fetchDeliveryOrders = async (req, res) => {
  try {
    // 1. Fetch only SHIPPED or DELIVERED orders
    const orders = await Order.find({
      orderState: { $in: ["SHIPPED", "DELIVERED"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No delivery orders found" });
    }

    // 2. Enrich each order with product, product details, customer, and address
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {

        // Fetch product from Product schema
        const product = await Product.findOne({ productId: order.productId }).lean();

        // Fetch product details from ProductDetails schema
        const productDetails = await ProductDetails.findOne({ productId: order.productId }).lean();

        // Fetch customer from User schema
        const customer = await User.findOne({ customerId: order.customerId })
          .select("-password -token")
          .lean();

        // Fetch customer address from UserAddress schema
        // NOTE: explicitly selecting all fields including the `location` (lat/lng) sub-document
        const address = await UserAddress.findOne({ customerId: order.customerId })
          .select(
            "userId userEmail customerId username " +
            "addressLine1 addressLine2 city district state pincode country " +
            "location"   // ← GPS coordinates set from map picker
          )
          .lean();

        return {
          ...order,
          product:         product || null,
          productDetails:  productDetails?.details || [],
          customer:        customer || null,
          // deliveryAddress now includes `location: { lat, lng, label }` if set
          deliveryAddress: address || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedOrders.length,
      orders: enrichedOrders,
    });

  } catch (error) {
    console.error("fetchDeliveryOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch delivery orders",
      error: error.message,
    });
  }
};


// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


// SEND DELIVERY CODE
export const sendDeliveryCode = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "OrderId is required",
      });
    }

    // generate random 6 digit code
    const code = generateCode();

    // check existing order code
    const existing = await DeliveryCode.findOne({ orderId });

    if (existing) {
      existing.code = code;
      existing.verified = false;
      await existing.save();
    } else {
      await DeliveryCode.create({ orderId, code });
    }

    console.log("Generated Delivery Code:", code);

    return res.status(200).json({
      success: true,
      message: "Delivery code generated successfully",
      code,
    });

  } catch (error) {
    console.log("sendDeliveryCode Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// VERIFY DELIVERY CODE
export const verifyDeliveryCode = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { code } = req.body;

    const deliveryCode = await DeliveryCode.findOne({ orderId });

    if (!deliveryCode) {
      return res.status(404).json({
        success: false,
        message: "Code not found",
      });
    }

    if (deliveryCode.code !== code) {
      return res.status(400).json({
        success: false,
        message: "Invalid code",
      });
    }

    deliveryCode.verified = true;
    await deliveryCode.save();

    return res.status(200).json({
      success: true,
      message: "Code verified successfully",
    });

  } catch (error) {
    console.log("verifyDeliveryCode Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};