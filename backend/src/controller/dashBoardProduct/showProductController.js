// controllers/productBuyController.js
import Product       from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";
import Order          from "../../model/order/order.js";
import DeliveryCode   from "../../model/order/deliveryCodeSchema.js";
import Return         from "../../model/order/returnSchema.js";

// ─── Get Products By Category ─────────────────────────────────────────────────
// GET /productBuy/getProductsByCategory?category=Men&page=1&limit=10
export const getProductsByCategory = async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;

    const VALID_CATEGORIES = [
      "Men","Women","Kids","Earrings","Necklaces","Oversized","Hoodies",
    ];

    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required." });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const filter = { category, status: { $in: ["Active", "Low"] } };

    const [products, total] = await Promise.all([
      Product.find(filter, {
        productId: 1, productName: 1, price: 1, discount: 1, finalPrice: 1,
        stockBySize: 1, productColor: 1, productImages: { $slice: 1 }, _id: 0,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const shaped = products.map((p) => ({
      id:         p.productId,
      name:       p.productName,
      price:      p.price,
      discount:   p.discount,
      finalPrice: p.finalPrice,
      image:      p.productImages?.[0] ?? null,
      color:      p.productColor || null,
      sizeStock:  {
        S:   p.stockBySize?.s   ?? 0,
        M:   p.stockBySize?.m   ?? 0,
        L:   p.stockBySize?.l   ?? 0,
        XL:  p.stockBySize?.xl  ?? 0,
        XXL: p.stockBySize?.xxl ?? 0,
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        category,
        products: shaped,
        total,
        page:        pageNum,
        totalPages:  Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("getProductsByCategory error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};

// ─── Get Single Product By ProductId ─────────────────────────────────────────
// GET /productBuy/fetchProductById/:productId
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required." });
    }

    const [product, productDetails] = await Promise.all([
      Product.findOne({ productId }).lean(),
      ProductDetails.findOne({ productId }).lean(),
    ]);

    if (!product) {
      return res.status(404).json({ success: false, message: `Product ${productId} not found.` });
    }

    const COLOR_CATEGORIES = ["Men","Women","Kids","Hoodies","Oversized"];
    const hasColor = COLOR_CATEGORIES.includes(product.category);

    const shaped = {
      id:           product.productId,
      name:         product.productName,
      category:     product.category,
      subCategory:  product.subCategory,
      price:        product.price,
      discount:     product.discount,
      finalPrice:   product.finalPrice,
      delivery:     product.estimatedDelivery,
      stock:        product.totalStock,
      status:       product.status,
      sizeStock: product.stockBySize
        ? { S: product.stockBySize.s, M: product.stockBySize.m, L: product.stockBySize.l, XL: product.stockBySize.xl, XXL: product.stockBySize.xxl }
        : null,
      color: hasColor && product.productColor?.name
        ? { name: product.productColor.name, hex: product.productColor.hex }
        : null,
      images:  product.productImages,
      details: productDetails?.details || [],
    };

    return res.status(200).json({ success: true, data: shaped });
  } catch (error) {
    console.error("getProductById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};

// ─── Place Order ──────────────────────────────────────────────────────────────
// POST /productBuy/placeOrder
export const placeOrder = async (req, res) => {
  try {
    const { productId, customerId, productPrice, deliveryCharge, totalPrice, size, quantity, payMethod } = req.body;

    if (!productId || !customerId || !productPrice || !totalPrice || !payMethod || !quantity) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const order = await Order.create({
      productId,
      customerId,
      productPrice,
      deliveryCharge: deliveryCharge ?? 0,
      totalPrice,
      size: size || null,
      quantity,
      payMethod,
      paymentStatus: payMethod === "COD" ? "PENDING" : "PAID",
      orderState:    "PLACED",
    });

    return res.status(201).json({ success: true, message: "Order placed successfully.", data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Orders By CustomerId ────────────────────────────────────────────
// GET /productBuy/getUserOrder/:customerId
export const getCustomerOrders = async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!customerId) {
      return res.status(400).json({ success: false, message: "customerId is required." });
    }

    const orders = await Order.find({ customerId }).sort({ createdAt: -1 }).lean();

    if (!orders || orders.length === 0) {
      return res.status(200).json({ success: true, message: "No orders found.", data: [] });
    }

    const productIds = [...new Set(orders.map((o) => o.productId))];
    const orderIds   = orders.map((o) => o.orderId);

    const [products, allProductDetails, deliveryCodes, returns] = await Promise.all([
      Product.find({ productId: { $in: productIds } }).lean(),
      ProductDetails.find({ productId: { $in: productIds } }).lean(),
      DeliveryCode.find({ orderId: { $in: orderIds } }).lean(),
      Return.find({ orderId: { $in: orderIds } }).lean(),       // ← NEW
    ]);

    const productMap        = {};
    const productDetailsMap = {};
    const deliveryCodeMap   = {};
    const returnMap         = {};                               // ← NEW

    products.forEach((p)        => { productMap[p.productId]          = p;  });
    allProductDetails.forEach((d) => { productDetailsMap[d.productId] = d;  });
    deliveryCodes.forEach((dc)  => { deliveryCodeMap[dc.orderId]       = dc; });
    returns.forEach((r)         => { returnMap[r.orderId]              = r;  }); // ← NEW

    const COLOR_CATEGORIES = ["Men","Women","Kids","Hoodies","Oversized"];

    const shaped = orders.map((order) => {
      const product = productMap[order.productId]        || null;
      const details = productDetailsMap[order.productId] || null;
      const dcEntry = deliveryCodeMap[order.orderId]     || null;
      const retEntry = returnMap[order.orderId]          || null; // ← NEW

      let productBlock = null;
      if (product) {
        const hasColor = COLOR_CATEGORIES.includes(product.category);
        productBlock = {
          productId:         product.productId,
          name:              product.productName,
          category:          product.category,
          subCategory:       product.subCategory || null,
          price:             product.price,
          discount:          product.discount,
          finalPrice:        product.finalPrice,
          estimatedDelivery: product.estimatedDelivery,
          status:            product.status,
          totalStock:        product.totalStock,
          stockBySize: product.stockBySize
            ? { S: product.stockBySize.s, M: product.stockBySize.m, L: product.stockBySize.l, XL: product.stockBySize.xl, XXL: product.stockBySize.xxl }
            : null,
          color: hasColor && product.productColor?.name
            ? { name: product.productColor.name, hex: product.productColor.hex }
            : null,
          images:    product.productImages || [],
          thumbnail: product.productImages?.[0] || null,
          details:   details?.details || [],
        };
      }

      return {
        orderId:            order.orderId,
        orderDate:          order.createdAt,
        productId:          order.productId,
        size:               order.size,
        quantity:           order.quantity,
        productPrice:       order.productPrice,
        deliveryCharge:     order.deliveryCharge,
        totalPrice:         order.totalPrice,
        payMethod:          order.payMethod,
        paymentStatus:      order.paymentStatus,
        orderState:         order.orderState,
        deliveryCode: dcEntry
          ? { code: dcEntry.code, verified: dcEntry.verified }
          : null,
        returnInfo: retEntry                                     // ← NEW
          ? {
              returnId:     retEntry.returnId,
              returnCause:  retEntry.returnCause,
              returnStatus: retEntry.returnStatus,
              returnedAt:   order.returnedAt,
            }
          : null,
        product: productBlock,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully.",
      total:   shaped.length,
      data:    shaped,
    });
  } catch (error) {
    console.error("getCustomerOrders error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};

// ─── Update Order Status ──────────────────────────────────────────────────────
// PUT /productBuy/updateOrderStatus/:orderId
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId }              = req.params;
    const { orderState, reason }   = req.body;

    if (!orderId)     return res.status(400).json({ success: false, message: "orderId is required." });
    if (!orderState)  return res.status(400).json({ success: false, message: "orderState is required." });

    const allowedStates = ["PLACED","CONFIRMED","SHIPPED","DELIVERED","CANCELLED","RETURNED"];
    if (!allowedStates.includes(orderState)) {
      return res.status(400).json({ success: false, message: "Invalid order state." });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    if (order.orderState === orderState) {
      return res.status(400).json({ success: false, message: `Order already ${orderState}.` });
    }

    // RETURNED can only be requested from DELIVERED
    if (orderState === "RETURNED" && order.orderState !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned.",
      });
    }

    // Prevent changing terminal states (except DELIVERED → RETURNED)
    if (
      ["CANCELLED"].includes(order.orderState) ||
      (order.orderState === "RETURNED")
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot update a ${order.orderState} order.`,
      });
    }

    const updateData = { orderState };

    if (orderState === "CANCELLED") {
      updateData.cancelledAt        = new Date();
      updateData.cancellationReason = reason || "No reason provided";
      if (order.size && order.quantity) {
        const sizeKey = order.size.toLowerCase();
        await Product.findOneAndUpdate(
          { productId: order.productId },
          { $inc: { totalStock: order.quantity, [`stockBySize.${sizeKey}`]: order.quantity } }
        );
      }
    }

    if (orderState === "DELIVERED") updateData.deliveredAt  = new Date();
    if (orderState === "CONFIRMED") updateData.confirmedAt  = new Date();
    if (orderState === "SHIPPED")   updateData.shippedAt    = new Date();
    if (orderState === "RETURNED")  updateData.returnedAt   = new Date();  // ← NEW

    const updated = await Order.findOneAndUpdate({ orderId }, { $set: updateData }, { new: true });

    return res.status(200).json({
      success: true,
      message: `Order ${orderState.toLowerCase()} successfully.`,
      data:    updated,
    });
  } catch (error) {
    console.error("updateOrderStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};

// ─── Submit Return Request ────────────────────────────────────────────────────
// POST /productBuy/submitReturn
export const submitReturn = async (req, res) => {
  try {
    const { orderId, customerId, productId, returnCause, returnImage } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!orderId || !customerId || !productId || !returnCause) {
      return res.status(400).json({
        success: false,
        message: "orderId, customerId, productId, and returnCause are required.",
      });
    }

    const VALID_CAUSES = [
      "Defective / Damaged product",
      "Wrong item delivered",
      "Item not as described",
      "Size / fit issue",
      "Changed my mind",
      "Missing parts or accessories",
      "Other",
    ];
    if (!VALID_CAUSES.includes(returnCause)) {
      return res.status(400).json({ success: false, message: "Invalid returnCause." });
    }

    // ── Verify the order exists, belongs to customer, and is DELIVERED ────────
    const order = await Order.findOne({ orderId, customerId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    if (order.orderState !== "DELIVERED") {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned." });
    }

    // ── Prevent duplicate return ───────────────────────────────────────────────
    const existing = await Return.findOne({ orderId });
    if (existing) {
      return res.status(400).json({ success: false, message: "A return has already been requested for this order." });
    }

    // ── Create return record ──────────────────────────────────────────────────
    const returnRecord = await Return.create({
      orderId,
      customerId,
      productId,
      returnCause,
      returnImage: returnImage || null,
    });

    // ── Update order state to RETURNED ────────────────────────────────────────
    await Order.findOneAndUpdate(
      { orderId },
      { $set: { orderState: "RETURNED", returnedAt: new Date() } }
    );

    return res.status(201).json({
      success: true,
      message: "Return request submitted successfully.",
      data:    returnRecord,
    });
  } catch (error) {
    console.error("submitReturn error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};

// ─── Get Return Info By OrderId ───────────────────────────────────────────────
// GET /productBuy/getReturn/:orderId
export const getReturnByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    const returnRecord = await Return.findOne({ orderId }).lean();
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: "No return found for this order." });
    }

    return res.status(200).json({ success: true, data: returnRecord });
  } catch (error) {
    console.error("getReturnByOrderId error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};