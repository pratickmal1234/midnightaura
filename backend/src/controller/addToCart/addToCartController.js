// controllers/cart.controller.js
import CartItem from "../../model/cart/cartSchema.js";
import Product  from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";
import Address from "../../model/user/userAddress.js";
import CartOrder from "../../model/order/cartOrder.js";
import User        from "../../model/user/userSchema.js";
import UserAddress  from "../../model/user/userAddress.js";
import DeliveryCode   from "../../model/order/deliveryCodeSchema.js";
import Return         from "../../model/order/returnSchema.js";
import Feedback from "../../model/user/userFeedback.js";
// ─────────────────────────────────────────────────────────────────────────────
// POST /cart/addToCart
// Body: { customerId, productId, size? }
// ─────────────────────────────────────────────────────────────────────────────
export const addToCart = async (req, res) => {
  try {
    const { customerId, productId, size = null } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    // ── 1. Validate product exists ──────────────────────────────────────────
    // Products use custom string IDs (e.g. "MA001"), not MongoDB ObjectIds,
    // so we query by the field your schema actually stores the ID in.
    const product = await Product.findOne({ productId: productId })
      || await Product.findOne({ _id: productId }).catch(() => null);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // ── 2. Validate size if product has size variants ───────────────────────
    const hasSizeVariants =
      product.sizeStock && Object.keys(product.sizeStock).length > 0;

    if (hasSizeVariants) {
      if (!size) {
        return res.status(400).json({ success: false, message: "Size is required for this product" });
      }
      // Support both Mongoose Map type and plain Object
      const stock = product.sizeStock instanceof Map
        ? product.sizeStock.get(size)
        : product.sizeStock[size];

      if (!stock || stock <= 0) {
        return res.status(400).json({ success: false, message: `Size ${size} is out of stock` });
      }
    }

    // ── 3. Upsert: increment qty if same item already in cart ───────────────
    const cartItem = await CartItem.findOneAndUpdate(
      { customerId, productId, size },
      {
        $inc: { quantity: 1 },
        $setOnInsert: { addedAt: new Date() },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Item added to cart",
      data: cartItem,
    });
  } catch (error) {
    console.error("[addToCart]", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /cart/getCart/:customerId
// Returns all cart items for the customer, populated with product info
// ─────────────────────────────────────────────────────────────────────────────
// export const getCart = async (req, res) => {
//   try {
//     const { customerId } = req.params;   // ✅ from URL param, not req.body

//     if (!customerId) {
//       return res.status(400).json({ success: false, message: "customerId is required" });
//     }

//     const items = await CartItem.find({ customerId })
//       .populate("productId", "name price finalPrice discount image sizeStock")
//       .sort({ addedAt: -1 });

//     const total = items.reduce((sum, item) => {
//       const price = item.productId?.finalPrice || item.productId?.price || 0;
//       return sum + price * item.quantity;
//     }, 0);

//     return res.status(200).json({
//       success: true,
//       data: items,
//       totalItems: items.length,
//       totalPrice: total,
//     });
//   } catch (error) {
//     console.error("[getCart]", error);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };
export const getCart = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }

    // ── Step 1: Fetch cart items, newest first ────────────────────────────────
    const cartItems = await CartItem.find({ customerId }).sort({ addedAt: -1 }).lean();

    if (!cartItems || cartItems.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: [],
        address: null,
        summary: { subtotal: 0, totalDiscount: 0, deliveryCharge: 0, totalAmount: 0, totalItems: 0 },
      });
    }

    // ── Step 2: Collect unique productIds ─────────────────────────────────────
    const productIds = [...new Set(cartItems.map((c) => c.productId))];

    // ── Step 3: Batch-fetch Product, ProductDetails, Address in parallel ──────
    const [products, allProductDetails, customerAddress] = await Promise.all([
      Product.find({ productId: { $in: productIds } }).lean(),
      ProductDetails.find({ productId: { $in: productIds } }).lean(),
      Address.findOne({ customerId }).lean(),   // primary address
    ]);

    // ── Step 4: Build O(1) lookup maps ────────────────────────────────────────
    const productMap        = {};
    const productDetailsMap = {};

    products.forEach((p)       => { productMap[p.productId]        = p; });
    allProductDetails.forEach((d) => { productDetailsMap[d.productId] = d; });

    // ── Categories that support color ─────────────────────────────────────────
    const COLOR_CATEGORIES = ["Men", "Women", "Kids", "Hoodies", "Oversized"];

    // ── Step 5: Shape each cart item ──────────────────────────────────────────
    let subtotal      = 0;
    let totalDiscount = 0;

    const shaped = cartItems.map((item) => {
      const product = productMap[item.productId]        || null;
      const details = productDetailsMap[item.productId] || null;

      let productBlock = null;

      if (product) {
        const hasColor = COLOR_CATEGORIES.includes(product.category);

        // Get stock for the selected size (or totalStock for no-size products)
        const sizeStock = product.stockBySize
          ? {
              S:   product.stockBySize.s   ?? 0,
              M:   product.stockBySize.m   ?? 0,
              L:   product.stockBySize.l   ?? 0,
              XL:  product.stockBySize.xl  ?? 0,
              XXL: product.stockBySize.xxl ?? 0,
            }
          : null;

        productBlock = {
          productId:         product.productId,
          name:              product.productName,
          category:          product.category,
          subCategory:       product.subCategory || null,
          mrp:               product.price,          // original price (for strikethrough)
          discount:          product.discount,
          finalPrice:        product.finalPrice,
          estimatedDelivery: product.estimatedDelivery,
          status:            product.status,
          totalStock:        product.totalStock,
          sizeStock,
          color: hasColor && product.productColor?.name
            ? { name: product.productColor.name, hex: product.productColor.hex }
            : null,
          images:    product.productImages || [],
          thumbnail: product.productImages?.[0] || null,
          details:   details?.details || [],
        };

        // Accumulate totals
        subtotal      += product.price       * item.quantity;
        totalDiscount += (product.price - product.finalPrice) * item.quantity;
      }

      return {
        cartId:    item.cartId,
        productId: item.productId,
        size:      item.size,
        quantity:  item.quantity,
        addedAt:   item.addedAt,
        product:   productBlock,
      };
    });

    // ── Step 6: Delivery charge = 8% of subtotal after discount ──────────────
    const afterDiscount  = subtotal - totalDiscount;
    const deliveryCharge = Math.round(afterDiscount * 0.08);
    const totalAmount    = afterDiscount + deliveryCharge;

    return res.status(200).json({
      success: true,
      data: shaped,
      address: customerAddress || null,
      summary: {
        subtotal:       Math.round(subtotal),
        totalDiscount:  Math.round(totalDiscount),
        deliveryCharge,
        totalAmount:    Math.round(totalAmount),
        totalItems:     shaped.length,
      },
    });

  } catch (error) {
    console.error("[getCart]", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /cart/remove/:cartId
// Body: { customerId }
// Removes a single item by its cartId string
// ─────────────────────────────────────────────────────────────────────────────
export const removeFromCart = async (req, res) => {
  try {
    const { cartId }     = req.params;   // ✅ from URL param
    const { customerId } = req.body;     // ✅ from body (not the whole req.body object)

    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }

    const deleted = await CartItem.findOneAndDelete({ cartId, customerId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    return res.status(200).json({ success: true, message: "Item removed from cart" });
  } catch (error) {
    console.error("[removeFromCart]", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /cart/updateQuantity/:cartId
// Body: { customerId, quantity }
// ─────────────────────────────────────────────────────────────────────────────
export const updateQuantity = async (req, res) => {
  try {
    const { cartId }              = req.params;
    const { customerId, quantity } = req.body;   // ✅ destructured properly
 
    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }
    if (typeof quantity !== "number" || quantity < 0) {
      return res.status(400).json({ success: false, message: "Invalid quantity" });
    }
 
    // qty = 0  →  treat as remove
    if (quantity === 0) {
      await CartItem.findOneAndDelete({ cartId, customerId });
      return res.status(200).json({ success: true, message: "Item removed from cart" });
    }
 
    const updated = await CartItem.findOneAndUpdate(
      { cartId, customerId },
      { $set: { quantity } },
      { new: true }
    );
 
    if (!updated) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }
 
    return res.status(200).json({ success: true, message: "Quantity updated", data: updated });
  } catch (error) {
    console.error("[updateQuantity]", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /cart/clear
// Body: { customerId }
// Wipes the entire cart for the customer (e.g. after checkout)
// ─────────────────────────────────────────────────────────────────────────────
export const clearCart = async (req, res) => {
  try {
    const { customerId } = req.body;     // ✅ destructured properly

    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required" });
    }

    await CartItem.deleteMany({ customerId });
    return res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error) {
    console.error("[clearCart]", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

















export const placeCartOrder = async (req, res) => {
  try {
    const {
      customerId,
      items,

      subtotal,
      mrpTotal,
      totalDiscount,

      voucherId = null,
      voucherDiscount = 0,

      deliveryCharge,
      totalPrice,

      payMethod,
    } = req.body;

    if (
      !customerId ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !payMethod
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
      });
    }

    // ── Fetch all products ─────────────────────────────────────────────
    const productIds = [...new Set(items.map((i) => i.productId))];

    const products = await Product.find({
      productId: { $in: productIds },
    }).lean();

    const productMap = {};
    products.forEach((p) => {
      productMap[p.productId] = p;
    });

    // ── Build line items ───────────────────────────────────────────────
    const shapedItems = [];

    for (const item of items) {
      const p = productMap[item.productId];

      if (!p) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found.`,
        });
      }

      const unitPrice = p.finalPrice || p.price;
      const mrp = p.price;
      const qty = Math.max(1, Math.min(10, Number(item.quantity)));
      const lineTotal = unitPrice * qty;

      shapedItems.push({
        productId: p.productId,
        productName: p.productName,
        productImage: p.productImages?.[0] ?? null,
        size: item.size || null,
        quantity: qty,
        unitPrice,
        mrp,
        discount: p.discount || 0,
        lineTotal,
      });
    }

    // ── Save order ─────────────────────────────────────────────────────
    const order = await CartOrder.create({
      customerId,

      items: shapedItems,

      subtotal: Math.round(Number(subtotal)),
      mrpTotal: Math.round(Number(mrpTotal)),
      totalDiscount: Math.round(Number(totalDiscount)),

      voucherId: voucherId || null,
      voucherDiscount: Math.round(Number(voucherDiscount)),

      deliveryCharge: Number(deliveryCharge),
      totalPrice: Number(totalPrice),

      payMethod,
      paymentStatus: payMethod === "COD" ? "PENDING" : "PAID",
      orderState: "PLACED",
    });

    // ── Clear cart ─────────────────────────────────────────────────────
    try {
      await CartItem.deleteMany({ customerId });
    } catch (cartErr) {
      console.warn(
        "Could not clear cart after order:",
        cartErr.message
      );
    }

    return res.status(201).json({
      success: true,
      message: "Cart order placed successfully.",
      data: order,
    });
  } catch (err) {
    console.error("placeCartOrder error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


 
// ─── GET /cartOrder/getCartOrders/:customerId ─────────────────────────────────
export const getCartOrdersByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "customerId is required.",
      });
    }

    const orders = await CartOrder.find({ customerId })
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No cart orders found.",
        data: [],
      });
    }

    const cartOrderIds = orders.map((o) => o.cartOrderId);

    const [deliveryCodes, returns] = await Promise.all([
      DeliveryCode.find({
        orderId: { $in: cartOrderIds },
      }).lean(),

      Return.find({
        orderId: { $in: cartOrderIds },
      }).lean(),
    ]);

    const deliveryCodeMap = {};
    const returnMap = {};

    deliveryCodes.forEach((dc) => {
      deliveryCodeMap[dc.orderId] = dc;
    });

    returns.forEach((r) => {
      returnMap[r.orderId] = r;
    });

    const shaped = orders.map((order) => {
      const dcEntry = deliveryCodeMap[order.cartOrderId] || null;
      const retEntry = returnMap[order.cartOrderId] || null;

      return {
        cartOrderId: order.cartOrderId,
        createdAt: order.createdAt,

        customerId: order.customerId,
        orderState: order.orderState,

        totalItems: order.totalItems,
        totalPrice: order.totalPrice,
        deliveryCharge: order.deliveryCharge,

        payMethod: order.payMethod,
        paymentStatus: order.paymentStatus,

        deliveryAddress: order.deliveryAddress,

        deliveryCode: dcEntry
          ? {
              code: dcEntry.code,
              verified: dcEntry.verified,
            }
          : null,

        returnInfo: retEntry
          ? {
              returnId: retEntry.returnId,
              returnCause: retEntry.returnCause,
              returnStatus: retEntry.returnStatus,
              returnedAt: order.returnedAt,
            }
          : null,

        // ── NEW: per-stage timestamps, mirrors the single-order shape so the
        // frontend's progress bar can show a date under each completed stage
        // (Placed / Confirmed / Shipped / Delivered / Cancelled / Returned).
        // A stage's date stays null until that stage has actually happened.
        stageDates: {
          PLACED:    order.createdAt    || null,
          CONFIRMED: order.confirmedAt  || null,
          SHIPPED:   order.shippedAt    || null,
          DELIVERED: order.deliveredAt  || null,
          CANCELLED: order.cancelledAt  || null,
          RETURNED:  order.returnedAt   || null,
        },

        items: (order.items || []).map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          mrp: item.mrp,
          discount: item.discount,
          lineTotal: item.lineTotal,
        })),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Cart orders fetched successfully.",
      total: shaped.length,
      data: shaped,
    });
  } catch (err) {
    console.error("getCartOrdersByCustomer error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: err.message,
    });
  }
};
 
// ─── GET /cartOrder/getCartOrderById/:cartOrderId ────────────────────────────
// ─── GET /cartOrder/getCartOrderById/:cartOrderId ────────────────────────────
export const getCartOrderById = async (req, res) => {
  try {
    const { cartOrderId } = req.params;
    if (!cartOrderId) {
      return res.status(400).json({ success: false, message: "cartOrderId is required." });
    }

    const order = await CartOrder.findOne({ cartOrderId }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Cart order not found." });
    }

    const [customer, address] = await Promise.all([
      User.findOne({ customerId: order.customerId })
        .select("-password -token")
        .lean(),
      UserAddress.findOne({ customerId: order.customerId }).lean(),
    ]);

    const enrichedOrder = {
      ...order,
      customer:        customer || null,
      deliveryAddress: address || null,
    };

    return res.status(200).json({ success: true, data: enrichedOrder });
  } catch (err) {
    console.error("getCartOrderById error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
 
// ─── PUT /cartOrder/updateCartOrderStatus/:cartOrderId ───────────────────────
export const updateCartOrderStatus = async (req, res) => {
  try {
    const { cartOrderId } = req.params;
    const { orderState, reason } = req.body;
 
    if (!cartOrderId || !orderState) {
      return res.status(400).json({ success: false, message: "cartOrderId and orderState are required." });
    }
 
    const ALLOWED = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
    if (!ALLOWED.includes(orderState)) {
      return res.status(400).json({ success: false, message: "Invalid orderState." });
    }
 
    const order = await CartOrder.findOne({ cartOrderId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Cart order not found." });
    }
    if (order.orderState === orderState) {
      return res.status(400).json({ success: false, message: `Order is already ${orderState}.` });
    }
    if (["CANCELLED"].includes(order.orderState) || order.orderState === "RETURNED") {
      return res.status(400).json({ success: false, message: `Cannot update a ${order.orderState} order.` });
    }
    if (orderState === "RETURNED" && order.orderState !== "DELIVERED") {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned." });
    }
 
    const update = { orderState };
    if (orderState === "CONFIRMED") update.confirmedAt = new Date();
    if (orderState === "SHIPPED")   update.shippedAt   = new Date();
    if (orderState === "DELIVERED") update.deliveredAt = new Date();
    if (orderState === "RETURNED")  update.returnedAt  = new Date();
    if (orderState === "CANCELLED") {
      update.cancelledAt        = new Date();
      update.cancellationReason = reason || "No reason provided";
    }
 
    const updated = await CartOrder.findOneAndUpdate({ cartOrderId }, { $set: update }, { new: true });
    return res.status(200).json({ success: true, message: `Order ${orderState.toLowerCase()} successfully.`, data: updated });
  } catch (err) {
    console.error("updateCartOrderStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
 
// ─── GET /cartOrder/fetchAllCartOrders  (admin) ───────────────────────────────
/**
 * Returns all cart orders enriched with customer info.
 * Adjust the User model import path to match your project.
 */
// ─── GET /cartOrder/fetchAllCartOrders  (admin) ───────────────────────────────
export const fetchAllCartOrders = async (req, res) => {
  try {
    const orders = await CartOrder.find().sort({ createdAt: -1 }).lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No cart orders found" });
    }

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const [customer, address] = await Promise.all([
          User.findOne({ customerId: order.customerId })
            .select("-password -token")
            .lean(),
          UserAddress.findOne({ customerId: order.customerId }).lean(),
        ]);

        return {
          ...order,
          customer:        customer || null,
          deliveryAddress: address || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count:   enrichedOrders.length,
      orders:  enrichedOrders,
    });
  } catch (err) {
    console.error("fetchAllCartOrders error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};