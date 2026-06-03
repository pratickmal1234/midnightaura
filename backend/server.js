import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv/config";
import { dbConnect } from "./src/config/dbConnect.js";
import router from "./src/routes/adminRoutes.js";
import userRout from "./src/routes/userRoutes.js";
import productRoute from "./src/routes/productRoutes.js";
import productBuyRoutes from "./src/routes/productBuyRoutes.js";
import path from "path";
import deliveryProductRoute from "./src/routes/deliveryProductRoute.js";
import cartRouter from "./src/routes/cartRoute.js";
const app = express(); 
const allowedOrigins = [

  "http://localhost:3000","https://feedbacker-student.vercel.app","https://www.medocart.in","https://midnightaura-x1ss.vercel.app"
];

dbConnect();

const port = process.env.PORT || 6000
dbConnect()
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin like mobile apps or curl
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.urlencoded({ extended: true }))
app.use(express.json());
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

// ✅ 3) Routes
app.use("/admin", router);
app.use("/user", userRout);
app.use("/product",productRoute);
app.use("/productBuy", productBuyRoutes);
app.use("/delivery", deliveryProductRoute);
app.use("/cart", cartRouter);

app.listen(port, () => {
  console.log(`the server is running on ${port}`);
});