// controllers/dashBoardProduct/searchController.js
// GET /productBuy/search?q=earring&minPrice=0&maxPrice=500
import Product from "../../model/admin/productSchema.js";

const VALID_CATEGORIES = [
  "Men", "Women", "Kids", "Earrings", "Necklaces", "Oversized", "Hoodies",
];

// Category keyword map — if query matches these keywords, map to category
const CATEGORY_KEYWORDS = {
  men:        "Men",
  man:        "Men",
  gents:      "Men",
  male:       "Men",
  women:      "Women",
  woman:      "Women",
  ladies:     "Women",
  female:     "Women",
  girl:       "Women",
  girls:      "Women",
  kids:       "Kids",
  kid:        "Kids",
  children:   "Kids",
  child:      "Kids",
  boys:       "Kids",
  boy:        "Kids",
  earring:    "Earrings",
  earrings:   "Earrings",
  necklace:   "Necklaces",
  necklaces:  "Necklaces",
  chain:      "Necklaces",
  pendant:    "Necklaces",
  oversized:  "Oversized",
  hoodie:     "Hoodies",
  hoodies:    "Hoodies",
  hood:       "Hoodies",
  sweatshirt: "Hoodies",
};

const ROUTE_MAP = {
  Men:       "/user/dashboard/categories/men",
  Women:     "/user/dashboard/categories/women",
  Kids:      "/user/dashboard/categories/kids",
  Earrings:  "/user/dashboard/categories/earrings",
  Necklaces: "/user/dashboard/categories/necklaces",
  Oversized: "/user/dashboard/categories/oversized",
  Hoodies:   "/user/dashboard/categories/hoodies",
};

// Escape regex-special characters in a single search word
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /productBuy/search
 * Query params:
 *   q         — search string (optional if minPrice/maxPrice given)
 *   minPrice  — number (optional)
 *   maxPrice  — number (optional)
 *   limit     — default 8
 *
 * Matching rule (word-level, not whole-phrase):
 *   The query is split into words. A product matches if its name contains
 *   ANY of those words (case-insensitive). This means "red jjj" still
 *   matches products containing "red" even though "jjj" matches nothing —
 *   we no longer require the entire phrase "red jjj" to appear verbatim.
 *   Category keywords are checked the same way: any single word in the
 *   query that maps to / matches a category counts as a category hit.
 *
 * Returns:
 *   {
 *     success: true,
 *     categorySuggestionsType: "keyword" | "derived" | "none",
 *     categorySuggestions: [{ category, route, matchReason }],
 *     productSuggestions:  [{ id, name, category, price, finalPrice, discount, image, route }]
 *   }
 *
 * categorySuggestionsType tells the frontend WHY categories were suggested:
 *   - "keyword": at least one word in the query matched a category name/keyword
 *                directly (e.g. "earring", "hoodie") — this is a deliberate
 *                category-style search, so categories should be shown ABOVE products.
 *   - "derived": no word in the query matched a category keyword directly —
 *                categories were only inferred from the categories of matching
 *                products (e.g. "animated"). This is a NAME search, so products
 *                should be shown ABOVE categories on the frontend.
 *   - "none":    no category suggestions at all.
 */
export const searchProducts = async (req, res) => {
  try {
    const { q = "", minPrice, maxPrice, limit = 8 } = req.query;
    const query = q.trim().toLowerCase();

    const limitNum = Math.min(20, Math.max(1, parseInt(limit) || 8));

    // Split into individual non-empty words
    const words = query.length > 0 ? query.split(/\s+/).filter(Boolean) : [];

    // ── Build MongoDB filter ──────────────────────────────────────────────────
    const filter = { status: { $in: ["Active", "Low"] } };

    // Price filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.finalPrice = {};
      if (minPrice !== undefined) filter.finalPrice.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filter.finalPrice.$lte = parseFloat(maxPrice);
    }

    // Name filter — match if ANY word in the query appears in the product name.
    // This is what lets "red jjj" still find products containing "red".
    if (words.length > 0) {
      const alternation = words.map(escapeRegex).join("|");
      filter.productName = { $regex: alternation, $options: "i" };
    }

    // ── Detect category suggestions from query keywords (word-level) ───────
    const categorySuggestions = [];
    const seenCategories = new Set();

    for (const word of words) {
      // Direct keyword map hit
      const mappedCat = CATEGORY_KEYWORDS[word];
      if (mappedCat && !seenCategories.has(mappedCat)) {
        seenCategories.add(mappedCat);
        categorySuggestions.push({
          category:    mappedCat,
          route:       ROUTE_MAP[mappedCat],
          matchReason: `in ${mappedCat}`,
        });
      }

      // Category name itself appears as / within this word (e.g. "hoodies", "earring")
      for (const cat of VALID_CATEGORIES) {
        if (!seenCategories.has(cat) && word.includes(cat.toLowerCase())) {
          seenCategories.add(cat);
          categorySuggestions.push({
            category:    cat,
            route:       ROUTE_MAP[cat],
            matchReason: `in ${cat}`,
          });
        }
      }
    }

    // Was the category list produced by an actual keyword/category match in
    // the query text? Track this BEFORE we fall back to derived categories.
    const hasKeywordCategoryMatch = categorySuggestions.length > 0;

    // ── Fetch matching products ───────────────────────────────────────────────
    const products = await Product.find(filter, {
      productId:     1,
      productName:   1,
      category:      1,
      price:         1,
      discount:      1,
      finalPrice:    1,
      productImages: { $slice: 1 },
      _id:           0,
    })
      .sort({ finalPrice: 1 })
      .limit(limitNum)
      .lean();

    const productSuggestions = products.map((p) => ({
      id:         p.productId,
      name:       p.productName,
      category:   p.category,
      price:      p.price,
      finalPrice: p.finalPrice,
      discount:   p.discount,
      image:      p.productImages?.[0] ?? null,
      route:      ROUTE_MAP[p.category] ?? "/user/dashboard",
    }));

    // If no category suggestions from keyword but products found,
    // derive categories from found products (this is a NAME-based match).
    if (categorySuggestions.length === 0 && productSuggestions.length > 0) {
      for (const p of productSuggestions) {
        if (!seenCategories.has(p.category) && ROUTE_MAP[p.category]) {
          seenCategories.add(p.category);
          categorySuggestions.push({
            category:    p.category,
            route:       ROUTE_MAP[p.category],
            matchReason: `in ${p.category}`,
          });
        }
      }
    }

    // Decide the type flag for the frontend to use for ordering.
    let categorySuggestionsType = "none";
    if (hasKeywordCategoryMatch) {
      categorySuggestionsType = "keyword";
    } else if (categorySuggestions.length > 0) {
      categorySuggestionsType = "derived";
    }

    return res.status(200).json({
      success:                  true,
      categorySuggestionsType,
      categorySuggestions:      categorySuggestions.slice(0, 4),
      productSuggestions,
    });
  } catch (error) {
    console.error("searchProducts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error:   error.message,
    });
  }
};