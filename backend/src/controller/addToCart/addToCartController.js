// controllers/cart.controller.js
import CartItem from "../../model/cart/cartSchema.js";
import Product  from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";
import Address from "../../model/user/userAddress.js";
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