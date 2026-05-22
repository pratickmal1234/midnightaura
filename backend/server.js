import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv/config";
import { dbConnect } from "./src/config/dbConnect.js";
import router from "./src/routes/adminRoutes.js";
import userRout from "./src/routes/userRoutes.js";
const app = express(); 
const allowedOrigins = [

  "http://localhost:3000","https://feedbacker-student.vercel.app"
];
const app = express();
dbConnect();

const port = process.env.port || 6000
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
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.urlencoded({ extended: true }))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 3) Routes
app.use("/admin", router);
app.use("/user", userRout);

app.listen(port, () => {
  console.log(`the server is running on ${port}`);
});