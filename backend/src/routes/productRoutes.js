import express from "express"

import { adminLoginSchema, validateAdmin } from "../Validation/adminValidation.js"
import { loginAdmin, logoutAdmin, registerAdmin } from "../controller/admin/adminControllers.js"
import { verifyAdmin } from "../middleware/verifyAdmin.js"
import { addProduct, getProducts, updateProduct } from "../controller/admin/productController.js"
import upload from "../middleware/upload.js";
const productRoute = express.Router()



//product 
// productRoute.post("/addProduct", verifyAdmin, addProduct);
// productRoute.post("/updateProduct", verifyAdmin, updateProduct);
// productRoute.post("/fetchProduct", verifyAdmin, getProducts);

productRoute.post(
  "/addProduct",
  upload.array("images", 3),
  addProduct
);
productRoute.put(
  "/updateProduct/:productId",
  upload.array("images", 3),
  updateProduct
);
productRoute.get("/fetchProduct", getProducts);

export default productRoute;