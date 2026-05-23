import express from "express";
import { getProductById, getProductsByCategory } from "../controller/dashBoardProduct/showProductController.js";
const productBuyRoutes = express.Router();


productBuyRoutes.get("/fetchProductByCategory", getProductsByCategory );
productBuyRoutes.get("/fetchProductById/:productId", getProductById);

export default productBuyRoutes;