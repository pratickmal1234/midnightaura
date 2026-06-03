import express from "express";
import { fetchDeliveryOrders, sendDeliveryCode, verifyDeliveryCode } from "../controller/deliveryBoy/deliveryReceivedProduct.js";



const deliveryProductRoute = express.Router();


deliveryProductRoute.get("/fetchDeliveryProducts",fetchDeliveryOrders);
deliveryProductRoute.post("/sendDeliveryCode/:orderId",sendDeliveryCode);
deliveryProductRoute.post("/verifyDeliveryCode/:orderId",verifyDeliveryCode);

export default deliveryProductRoute;