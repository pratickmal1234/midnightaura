import express from "express"
import cors from "cors";

import dotenv from "dotenv/config"
import { dbConnect } from "./src/config/dbConnect.js"
import router from "./src/routes/adminRoutes.js"
import userRout from "./src/routes/userRoutes.js";


const app = express()

const port = process.env.port || 6000
dbConnect()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json());


app.use("/admin", router)
app.use("/user", userRout)

app.listen(port, () => {
  console.log(`the server is running on ${port}`);

})