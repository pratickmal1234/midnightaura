import express from "express";
import {getCustomerOrders, getProductById, getProductsByCategory, placeOrder, submitReturn, updateOrderStatus } from "../controller/dashBoardProduct/showProductController.js";
import { fetchOrders } from "../controller/admin/productController.js";
import { searchProducts } from "../controller/dashBoardProduct/searchController.js";
const productBuyRoutes = express.Router();

productBuyRoutes.get("/search", searchProducts);
productBuyRoutes.get("/fetchProductByCategory", getProductsByCategory );
productBuyRoutes.get("/fetchProductById/:productId", getProductById);
productBuyRoutes.post("/placeOrder", placeOrder);
productBuyRoutes.post("/submitReturn",submitReturn);
productBuyRoutes.get("/getUserOrder/:customerId", getCustomerOrders);
productBuyRoutes.put("/updateOrderStatus/:orderId", updateOrderStatus);
// productBuyRoutes.put("/cancelOrder/:orderId", cancelOrder);
export default productBuyRoutes;