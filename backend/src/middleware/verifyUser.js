import jwt from "jsonwebtoken";
import dotenv from "dotenv/config";



export const verifyUser = async (req, res, next) => {
    try {
        const token = req.cookies.userToken;
        // console.log(token);

        if (!token) {
            return res.status(401).json({ message: "user not authenticated" });
        }

        const decoded = jwt.verify(token, process.env.USER_JWT_SECRET);

        req.userId = decoded.id;
        next();
    } catch (e) {
        return res.status(500).json({
            success: false,
            message: e.message,
        })
    }
}