import express from "express";
import { fetchDeliveryOrders, loginDeliveryBoy, sendDeliveryCode, verifyDeliveryCode } from "../controller/deliveryBoy/deliveryReceivedProduct.js";
import { deliveryLoginSchema, validateDelivery } from "../Validation/deliveryValidation.js";



const deliveryProductRoute = express.Router();

deliveryProductRoute.post("/loginDeliveryBoy",validateDelivery(deliveryLoginSchema),loginDeliveryBoy);
deliveryProductRoute.get("/fetchDeliveryProducts",fetchDeliveryOrders);
deliveryProductRoute.post("/sendDeliveryCode/:orderId",sendDeliveryCode);
deliveryProductRoute.post("/verifyDeliveryCode/:orderId",verifyDeliveryCode);

export default deliveryProductRoute;