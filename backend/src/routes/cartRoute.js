// routes/cartRoute.js
import express from "express";
import {
  addToCart,
  getCart,
  removeFromCart,
  updateQuantity,
  clearCart,
} from "../controller/addToCart/addToCartController.js";

const cartRouter = express.Router();

cartRouter.post  ("/addToCart",               addToCart);       // POST   /cart/addToCart
cartRouter.get   ("/getCart/:customerId",      getCart);         // GET    /cart/getCart/:customerId
cartRouter.delete("/remove/:cartId",           removeFromCart);  // DELETE /cart/remove/:cartId
cartRouter.patch ("/updateQuantity/:cartId",   updateQuantity);  // PATCH  /cart/updateQuantity/:cartId
cartRouter.delete("/clearCart",                    clearCart);       // DELETE /cart/clear

export default cartRouter;