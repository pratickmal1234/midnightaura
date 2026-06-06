// controllers/productController.js
import Product        from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";
import Order          from "../../model/order/order.js";
import User           from "../../model/user/userSchema.js";
import UserAddress    from "../../model/user/userAddress.js";
import cloudinary     from "../../config/cloudinaryConfig.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIZE_ONLY_CATEGORIES = ["Hoodies", "Oversized"];
const CLOTHING_CATEGORIES  = ["Men", "Women", "Kids"];

const needsSizes = (category) =>
  CLOTHING_CATEGORIES.includes(category) || SIZE_ONLY_CATEGORIES.includes(category);

const computeStatus = (totalStock) => {
  if (totalStock === 0) return "Out";
  if (totalStock < 15)  return "Low";
  return "Active";
};

const computeFinalPrice = (price, discount) => {
  if (!discount) return price;
  return Math.round(price * (1 - discount / 100));
};

// Generates next productId like MA001, MA002, …
const generateProductId = async () => {
  const last = await Product.findOne({}, { productId: 1 })
    .sort({ createdAt: -1 })
    .lean();

  if (!last) return "MA001";

  const num = parseInt(last.productId.replace("MA", ""), 10);
  return "MA" + String(num + 1).padStart(3, "0");
};

/**
 * Delete an image from Cloudinary by its secure_url or public_id.
 * We store secure_url in the DB, so we derive the public_id from it.
 *
 * Example URL:
 *   https://res.cloudinary.com/<cloud>/image/upload/v123456/uploads/images/abc.jpg
 * public_id → uploads/images/abc   (no extension)
 */
const deleteCloudinaryImage = async (url) => {
  try {
    // Extract the portion after "/upload/" and strip the version segment (v12345/)
    const afterUpload = url.split("/upload/")[1];          // "v123456/uploads/images/abc.jpg"
    const withoutVersion = afterUpload.replace(/^v\d+\//, ""); // "uploads/images/abc.jpg"
    const publicId = withoutVersion.replace(/\.[^/.]+$/, "");  // "uploads/images/abc"

    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // Non-fatal — log and continue
    console.warn("Cloudinary delete warning:", err.message);
  }
};

// ─── Add Product ──────────────────────────────────────────────────────────────

export const addProduct = async (req, res) => {
  try {
    const {
      productName,
      category,
      subCategory,
      price,
      discount,
      estimatedDelivery,
      totalStock,
      stockBySize,
      productColor,
      details,
    } = req.body;

    // ── Validate required fields ──
    if (!productName || !category || !price) {
      // Rollback: delete any images already uploaded to Cloudinary
      if (req.files?.length) {
        await Promise.all(
          req.files.map((f) => cloudinary.uploader.destroy(f.filename))
        );
      }
      return res.status(400).json({
        success: false,
        message: "productName, category, and price are required.",
      });
    }

    // ── Validate images (exactly 3 required) ──
    if (!req.files || req.files.length !== 3) {
      if (req.files?.length) {
        await Promise.all(
          req.files.map((f) => cloudinary.uploader.destroy(f.filename))
        );
      }
      return res.status(400).json({
        success: false,
        message: "Exactly 3 product images are required.",
      });
    }

    // ── Parse JSON body fields ──
    const parsedStockBySize = stockBySize
      ? typeof stockBySize === "string" ? JSON.parse(stockBySize) : stockBySize
      : null;

    const parsedColor = productColor
      ? typeof productColor === "string" ? JSON.parse(productColor) : productColor
      : { name: "", hex: "" };

    const parsedDetails = details
      ? typeof details === "string" ? JSON.parse(details) : details
      : [];

    // ── Compute total stock ──
    let computedTotalStock = 0;
    let finalStockBySize   = {};

    if (needsSizes(category) && parsedStockBySize) {
      finalStockBySize = {
        s:   Number(parsedStockBySize.S   ?? parsedStockBySize.s   ?? 0),
        m:   Number(parsedStockBySize.M   ?? parsedStockBySize.m   ?? 0),
        l:   Number(parsedStockBySize.L   ?? parsedStockBySize.l   ?? 0),
        xl:  Number(parsedStockBySize.XL  ?? parsedStockBySize.xl  ?? 0),
        xxl: Number(parsedStockBySize.XXL ?? parsedStockBySize.xxl ?? 0),
      };
      computedTotalStock = Object.values(finalStockBySize).reduce((a, b) => a + b, 0);
    } else {
      computedTotalStock = Number(totalStock ?? 0);
    }

    // ── Generate productId ──
    const productId = await generateProductId();

    // ── Cloudinary returns secure_url on each uploaded file ──
    // multer-storage-cloudinary attaches `path` (secure_url) and `filename` (public_id)
    const imagePaths = req.files.map((f) => f.path); // secure_url from Cloudinary

    // ── Create Product ──
    const newProduct = await Product.create({
      productId,
      productName:       productName.trim(),
      category,
      subCategory:       subCategory || null,
      price:             Number(price),
      discount:          Number(discount ?? 0),
      finalPrice:        computeFinalPrice(Number(price), Number(discount ?? 0)),
      estimatedDelivery: estimatedDelivery || "Within 3 Days",
      totalStock:        computedTotalStock,
      stockBySize:       needsSizes(category) ? finalStockBySize : undefined,
      productColor:      parsedColor,
      productImages:     imagePaths,  // Cloudinary secure URLs
      status:            computeStatus(computedTotalStock),
    });

    // ── Create ProductDetails (only if details provided) ──
    const filteredDetails = parsedDetails.filter(
      (d) => d.field?.trim() && d.value?.trim()
    );

    if (filteredDetails.length > 0) {
      await ProductDetails.create({ productId, details: filteredDetails });
    }

    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      data: {
        productId:     newProduct.productId,
        productName:   newProduct.productName,
        category:      newProduct.category,
        subCategory:   newProduct.subCategory,
        price:         newProduct.price,
        discount:      newProduct.discount,
        finalPrice:    newProduct.finalPrice,
        totalStock:    newProduct.totalStock,
        status:        newProduct.status,
        productImages: newProduct.productImages, // Cloudinary URLs
      },
    });
  } catch (error) {
    // Rollback Cloudinary uploads on unexpected error
    if (req.files?.length) {
      await Promise.all(
        req.files.map((f) => cloudinary.uploader.destroy(f.filename))
      );
    }
    console.error("addProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

// ─── Update Product ───────────────────────────────────────────────────────────

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const existing = await Product.findOne({ productId });
    if (!existing) {
      // Rollback any newly uploaded images
      if (req.files?.length) {
        await Promise.all(
          req.files.map((f) => cloudinary.uploader.destroy(f.filename))
        );
      }
      return res.status(404).json({
        success: false,
        message: `Product ${productId} not found.`,
      });
    }

    const {
      productName,
      category,
      subCategory,
      price,
      discount,
      estimatedDelivery,
      totalStock,
      stockBySize,
      productColor,
      details,
      replaceImages, // "true" → replace all 3 images
    } = req.body;

    // ── Parse JSON fields ──
    const parsedStockBySize = stockBySize
      ? typeof stockBySize === "string" ? JSON.parse(stockBySize) : stockBySize
      : null;

    const parsedColor = productColor
      ? typeof productColor === "string" ? JSON.parse(productColor) : productColor
      : null;

    const parsedDetails = details
      ? typeof details === "string" ? JSON.parse(details) : details
      : null;

    // ── Resolve category ──
    const resolvedCategory = category || existing.category;

    // ── Compute stock ──
    let computedTotalStock = existing.totalStock;
    let finalStockBySize   = existing.stockBySize;

    if (needsSizes(resolvedCategory) && parsedStockBySize) {
      finalStockBySize = {
        s:   Number(parsedStockBySize.S   ?? parsedStockBySize.s   ?? 0),
        m:   Number(parsedStockBySize.M   ?? parsedStockBySize.m   ?? 0),
        l:   Number(parsedStockBySize.L   ?? parsedStockBySize.l   ?? 0),
        xl:  Number(parsedStockBySize.XL  ?? parsedStockBySize.xl  ?? 0),
        xxl: Number(parsedStockBySize.XXL ?? parsedStockBySize.xxl ?? 0),
      };
      computedTotalStock = Object.values(finalStockBySize).reduce((a, b) => a + b, 0);
    } else if (!needsSizes(resolvedCategory) && totalStock !== undefined) {
      computedTotalStock = Number(totalStock);
    }

    // ── Handle image replacement ──
    let imagePaths = existing.productImages; // default: keep existing Cloudinary URLs

    if (replaceImages === "true" && req.files && req.files.length === 3) {
      // Delete old images from Cloudinary
      await Promise.all(existing.productImages.map(deleteCloudinaryImage));

      // Use newly uploaded Cloudinary URLs
      imagePaths = req.files.map((f) => f.path);
    } else if (req.files?.length > 0) {
      // Discard accidentally uploaded files from Cloudinary
      await Promise.all(
        req.files.map((f) => cloudinary.uploader.destroy(f.filename))
      );
    }

    // ── Compute price fields ──
    const resolvedPrice    = price    !== undefined ? Number(price)    : existing.price;
    const resolvedDiscount = discount !== undefined ? Number(discount) : existing.discount;

    // ── Update Product ──
    const updatedProduct = await Product.findOneAndUpdate(
      { productId },
      {
        $set: {
          productName:       productName?.trim()   || existing.productName,
          category:          resolvedCategory,
          subCategory:       subCategory !== undefined ? (subCategory || null) : existing.subCategory,
          price:             resolvedPrice,
          discount:          resolvedDiscount,
          finalPrice:        computeFinalPrice(resolvedPrice, resolvedDiscount),
          estimatedDelivery: estimatedDelivery       || existing.estimatedDelivery,
          totalStock:        computedTotalStock,
          stockBySize:       needsSizes(resolvedCategory) ? finalStockBySize : existing.stockBySize,
          productColor:      parsedColor              || existing.productColor,
          productImages:     imagePaths,              // Cloudinary URLs
          status:            computeStatus(computedTotalStock),
        },
      },
      { new: true }
    );

    // ── Update or create ProductDetails ──
    if (parsedDetails !== null) {
      const filteredDetails = parsedDetails.filter(
        (d) => d.field?.trim() && d.value?.trim()
      );

      await ProductDetails.findOneAndUpdate(
        { productId },
        { $set: { details: filteredDetails } },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: {
        productId:     updatedProduct.productId,
        productName:   updatedProduct.productName,
        category:      updatedProduct.category,
        subCategory:   updatedProduct.subCategory,
        price:         updatedProduct.price,
        discount:      updatedProduct.discount,
        finalPrice:    updatedProduct.finalPrice,
        totalStock:    updatedProduct.totalStock,
        status:        updatedProduct.status,
        productImages: updatedProduct.productImages, // Cloudinary URLs
      },
    });
  } catch (error) {
    if (req.files?.length) {
      await Promise.all(
        req.files.map((f) => cloudinary.uploader.destroy(f.filename))
      );
    }
    console.error("updateProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

// ─── Get Product List ─────────────────────────────────────────────────────────

export const getProducts = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 10,
      category,
      search,
      status,
    } = req.query;

    // ── Build filter ──
    const filter = {};
    if (category && category !== "All") filter.category = category;
    if (status)                         filter.status   = status;
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { productId:   { $regex: search, $options: "i" } },
      ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    // ── Attach product details ──
    const productIds  = products.map((p) => p.productId);
    const detailsDocs = await ProductDetails.find(
      { productId: { $in: productIds } }
    ).lean();

    const detailsMap = {};
    detailsDocs.forEach((d) => { detailsMap[d.productId] = d.details; });

    // ── Shape response ──
    // productImages are already Cloudinary secure_urls — return as-is
    const shaped = products.map((p) => ({
      id:          p.productId,
      name:        p.productName,
      category:    p.category,
      subCategory: p.subCategory,
      price:       p.price,
      discount:    p.discount,
      finalPrice:  p.finalPrice,
      delivery:    p.estimatedDelivery,
      stock:       p.totalStock,
      status:      p.status,
      sizeStock:   p.stockBySize
        ? {
            S:   p.stockBySize.s,
            M:   p.stockBySize.m,
            L:   p.stockBySize.l,
            XL:  p.stockBySize.xl,
            XXL: p.stockBySize.xxl,
          }
        : null,
      color:   p.productColor?.name ? p.productColor : null,
      images:  p.productImages,   // Cloudinary URLs — ready to use in <img src>
      details: detailsMap[p.productId] || [],
    }));

    return res.status(200).json({
      success: true,
      data: {
        products:    shaped,
        total,
        page:        pageNum,
        totalPages:  Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("getProducts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

// ─── Fetch All Orders ─────────────────────────────────────────────────────────

export const fetchOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found" });
    }

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const product        = await Product.findOne({ productId: order.productId }).lean();
        const productDetails = await ProductDetails.findOne({ productId: order.productId }).lean();
        const customer       = await User.findOne({ customerId: order.customerId })
          .select("-password -token")
          .lean();
        const address        = await UserAddress.findOne({ customerId: order.customerId }).lean();

        return {
          ...order,
          product:         product || null,
          productDetails:  productDetails?.details || [],
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
  } catch (error) {
    console.error("fetchOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error:   error.message,
    });
  }
};

// ─── Fetch Order By ID ────────────────────────────────────────────────────────

export const fetchOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).lean();
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const [product, productDetails, customer, address] = await Promise.all([
      Product.findOne({ productId: order.productId }).lean(),
      ProductDetails.findOne({ productId: order.productId }).lean(),
      User.findOne({ customerId: order.customerId })
        .select("-password -token")
        .lean(),
      UserAddress.findOne({ customerId: order.customerId }).lean(),
    ]);

    const enrichedOrder = {
      ...order,
      product:         product || null,
      productDetails:  productDetails?.details || [],
      customer:        customer || null,
      deliveryAddress: address || null,
    };

    return res.status(200).json({ success: true, order: enrichedOrder });
  } catch (error) {
    console.error("fetchOrderById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error:   error.message,
    });
  }
};