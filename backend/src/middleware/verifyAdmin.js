import jwt from "jsonwebtoken";
import dotenv from "dotenv/config";


export const verifyAdmin = (req, res, next) => {
  try {
    const token = req.cookies.adminToken;
    // console.log(token);

    if (!token) {
      return res.status(401).json({ message: "Admin not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    req.adminId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid admin token" });
  }
};


