import express from "express"
import { addProduct, fetchOrderById, fetchOrders, getProducts, updateProduct } from "../controller/admin/productController.js"
import { upload } from "../config/cloudinaryConfig.js"; // ← changed from upload.js

const productRoute = express.Router()

productRoute.post("/addProduct",               upload.array("images", 3), addProduct);
productRoute.put( "/updateProduct/:productId", upload.array("images", 3), updateProduct);
productRoute.get( "/fetchProduct",             getProducts);
productRoute.get( "/fetchOrders",              fetchOrders);
productRoute.get( "/fetchOrders/:orderId",     fetchOrderById);

export default productRoute;