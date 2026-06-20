import express from "express";
import {  consumeDiscount, getUserDiscounts, saveDiscount, validateDiscount } from "../controller/user/discountController.js";


const discountRoute = express.Router()


discountRoute.post("/saveDiscount",saveDiscount);
discountRoute.get("/discounts", getUserDiscounts);
discountRoute.post("/validateDiscount", validateDiscount);
discountRoute.post("/consumeDiscount",  consumeDiscount); 



export default discountRoute;