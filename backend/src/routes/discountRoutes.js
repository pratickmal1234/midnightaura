import express from "express";
import { applyDiscount, getUserDiscounts, saveDiscount } from "../controller/user/discountController.js";


const discountRoute = express.Router()


discountRoute.post("/saveDiscount",saveDiscount);
discountRoute.get("/discounts", getUserDiscounts);
discountRoute.post("/applyDiscount", applyDiscount);



export default discountRoute;