// controllers/productController.js
import Product from "../../model/admin/productSchema.js";
import ProductDetails from "../../model/admin/productDetails.js";
import fs from "fs";
import path from "path";

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

// Generates next productId like MA001, MA002, ...
const generateProductId = async () => {
  const last = await Product.findOne({}, { productId: 1 })
    .sort({ createdAt: -1 })
    .lean();

  if (!last) return "MA001";

  const num = parseInt(last.productId.replace("MA", ""), 10);
  return "MA" + String(num + 1).padStart(3, "0");
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
      totalStock,       // used when category has no sizes
      stockBySize,      // JSON string or object
      productColor,     // JSON string or object  { name, hex }
      details,          // JSON string or array   [{ field, value }]
    } = req.body;

    // ── Validate required fields ──
    if (!productName || !category || !price) {
      // Clean up any uploaded files on validation failure
      if (req.files) req.files.forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, message: "productName, category, and price are required." });
    }

    // ── Validate images (exactly 3 required) ──
    if (!req.files || req.files.length !== 3) {
      if (req.files) req.files.forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, message: "Exactly 3 product images are required." });
    }

    // ── Parse JSON body fields (sent as strings from multipart/form-data) ──
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

    // ── Image paths (store relative paths, e.g. /uploads/products/filename.jpg) ──
    const imagePaths = req.files.map(
      (f) => "/uploads/products/" + path.basename(f.path)
    );

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
      productImages:     imagePaths,
      status:            computeStatus(computedTotalStock),
    });

    // ── Create ProductDetails (only if details provided) ──
    const filteredDetails = parsedDetails.filter(
      (d) => d.field?.trim() && d.value?.trim()
    );

    if (filteredDetails.length > 0) {
      await ProductDetails.create({
        productId,
        details: filteredDetails,
      });
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
        productImages: newProduct.productImages,
      },
    });
  } catch (error) {
    // Clean up uploaded files on unexpected error
    if (req.files) req.files.forEach((f) => {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });
    console.error("addProduct error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};

// ─── Update Product ───────────────────────────────────────────────────────────

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const existing = await Product.findOne({ productId });
    if (!existing) {
      if (req.files) req.files.forEach((f) => fs.unlinkSync(f.path));
      return res.status(404).json({ success: false, message: `Product ${productId} not found.` });
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
      // Client can send "replaceImages" = "true" to replace all 3 images,
      // or send nothing to keep existing images
      replaceImages,
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

    // ── Resolve category (use incoming or fall back to existing) ──
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
    let imagePaths = existing.productImages;

    if (replaceImages === "true" && req.files && req.files.length === 3) {
      // Delete old images from disk
      existing.productImages.forEach((imgPath) => {
        const abs = path.join(process.cwd(), imgPath);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      });
      imagePaths = req.files.map(
        (f) => "/uploads/products/" + path.basename(f.path)
      );
    } else if (req.files && req.files.length > 0) {
      // Clean up any accidentally uploaded files
      req.files.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }

    // ── Compute price fields ──
    const resolvedPrice    = price !== undefined ? Number(price) : existing.price;
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
          productImages:     imagePaths,
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
        productImages: updatedProduct.productImages,
      },
    });
  } catch (error) {
    if (req.files) req.files.forEach((f) => {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });
    console.error("updateProduct error:", error);
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
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

    // ── Attach product details for each product ──
    const productIds   = products.map((p) => p.productId);
    const detailsDocs  = await ProductDetails.find(
      { productId: { $in: productIds } }
    ).lean();

    // Map details by productId for quick lookup
    const detailsMap = {};
    detailsDocs.forEach((d) => { detailsMap[d.productId] = d.details; });

    // ── Shape response to match frontend schema ──
    const shaped = products.map((p) => ({
      id:           p.productId,
      name:         p.productName,
      category:     p.category,
      subCategory:  p.subCategory,
      price:        p.price,
      discount:     p.discount,
      finalPrice:   p.finalPrice,
      delivery:     p.estimatedDelivery,
      stock:        p.totalStock,
      status:       p.status,
      sizeStock:    p.stockBySize
        ? {
            S:   p.stockBySize.s,
            M:   p.stockBySize.m,
            L:   p.stockBySize.l,
            XL:  p.stockBySize.xl,
            XXL: p.stockBySize.xxl,
          }
        : null,
      color:   p.productColor?.name ? p.productColor : null,
      images:  p.productImages,
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
    return res.status(500).json({ success: false, message: "Internal server error.", error: error.message });
  }
};