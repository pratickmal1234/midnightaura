
import Product from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";

export const getProductsByCategory = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 10,
      category,          // "Men" | "Women" | "Kids" | "Earrings" | "Necklaces" | "Oversized" | "Hoodies"
    } = req.query;

    // ── Validate category ──
    const VALID_CATEGORIES = ["Men", "Women", "Kids", "Earrings", "Necklaces", "Oversized", "Hoodies"];

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    // ── Pagination ──
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // ── Query: only active + low stock products, select minimal fields ──
    const filter = {
      category,
      status: { $in: ["Active", "Low"] },   // exclude "Out of Stock"
    };

    const [products, total] = await Promise.all([
      Product.find(filter, {
        productId:    1,   // id
        productName:  1,   // name
        price:        1,   // original price
        discount:     1,   // discount %
        finalPrice:   1,   // discounted price (pre-computed in DB)
        productImages: { $slice: 1 },  // only first image
        _id:          0,   // exclude mongo _id
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    // ── Shape response ──
    const shaped = products.map((p) => ({
      id:         p.productId,
      name:       p.productName,
      price:      p.price,
      discount:   p.discount,
      finalPrice: p.finalPrice,
      image:      p.productImages?.[0] ?? null,   // single image string, not array
    }));

    return res.status(200).json({
      success: true,
      data: {
        category,
        products:    shaped,
        total,
        page:        pageNum,
        totalPages:  Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
      },
    });

  } catch (error) {
    console.error("getProductsByCategory error:", error);
    return res.status(500).json({
      success:  false,
      message:  "Internal server error.",
      error:    error.message,
    });
  }
};








// controllers/productBuyController.js

// ─── Get Single Product By ProductId ─────────────────────────────────────────
// GET /productBuy/fetchProductById/:productId

export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required.",
      });
    }

    // ── Fetch product + details in parallel ──
    const [product, productDetails] = await Promise.all([
      Product.findOne({ productId }).lean(),
      ProductDetails.findOne({ productId }).lean(),
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product ${productId} not found.`,
      });
    }

    // ── Categories that support color ──
    const COLOR_CATEGORIES = ["Men", "Women", "Kids", "Hoodies", "Oversized"];
    const hasColor = COLOR_CATEGORIES.includes(product.category);

    // ── Shape response ──
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
      sizeStock:    product.stockBySize
        ? {
            S:   product.stockBySize.s,
            M:   product.stockBySize.m,
            L:   product.stockBySize.l,
            XL:  product.stockBySize.xl,
            XXL: product.stockBySize.xxl,
          }
        : null,
      // color only for relevant categories
      color: hasColor && product.productColor?.name
        ? { name: product.productColor.name, hex: product.productColor.hex }
        : null,
      images:  product.productImages,   // array of 3 relative paths
      details: productDetails?.details || [],
    };

    return res.status(200).json({
      success: true,
      data:    shaped,
    });

  } catch (error) {
    console.error("getProductById error:", error);
    return res.status(500).json({
      success:  false,
      message:  "Internal server error.",
      error:    error.message,
    });
  }
};