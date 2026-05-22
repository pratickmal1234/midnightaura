import express from "express"

import { adminLoginSchema, validateAdmin } from "../Validation/adminValidation.js"
import { loginAdmin, logoutAdmin, registerAdmin } from "../controller/admin/adminControllers.js"
import { verifyAdmin } from "../middleware/verifyAdmin.js"
import { addProduct, updateProduct } from "../controller/admin/productController.js"

const router = express.Router()

router.post("/register", registerAdmin)
router.post("/login", validateAdmin(adminLoginSchema), loginAdmin);
router.post("/logout", verifyAdmin, logoutAdmin);

//product 
router.post("/addProduct", verifyAdmin, addProduct);
router.post("/updateProduct", verifyAdmin, updateProduct);











export default router