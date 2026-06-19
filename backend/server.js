import express        from "express";
import cookieParser    from "cookie-parser";
import cors            from "cors";
import dotenv          from "dotenv/config";
import { dbConnect }   from "./src/config/dbConnect.js";
import router          from "./src/routes/adminRoutes.js";
import userRout        from "./src/routes/userRoutes.js";
import productRoute    from "./src/routes/productRoutes.js";
import productBuyRoutes from "./src/routes/productBuyRoutes.js";
import deliveryProductRoute from "./src/routes/deliveryProductRoute.js";
import cartRouter      from "./src/routes/cartRoute.js";
import discountRoute from "./src/routes/discountRoutes.js";

const app = express();

const allowedOrigins = [
  "https://www.chomoktomok.com",
  "http://localhost:3000",
  "https://feedbacker-student.vercel.app",
  
];

dbConnect();

const port = process.env.PORT || 6000;

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials:    true,
    methods:        ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// NOTE: No express.static("/uploads") needed — images are served directly
//       from Cloudinary via their secure_url stored in the database.

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/admin",       router);
app.use("/user",        userRout);
app.use("/product",     productRoute);
app.use("/productBuy",  productBuyRoutes);
app.use("/delivery",    deliveryProductRoute);
app.use("/cart",        cartRouter);
app.use("/discount",discountRoute);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});