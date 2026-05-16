import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv/config";
import { dbConnect } from "./src/config/dbConnect.js";
import router from "./src/routes/adminRoutes.js";
import userRout from "./src/routes/userRoutes.js";

const app = express();
const port = process.env.port;

dbConnect();

// ✅ 1) CORS FIRST
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// ✅ 2) Parsers
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 3) Routes
app.use("/admin", router);
app.use("/user", userRout);

app.listen(port, () => {
  console.log(`the server is running on ${port}`);
});