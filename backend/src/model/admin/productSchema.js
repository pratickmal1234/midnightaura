import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        productName: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            required: true,
            enum: ["Men", "Women", "Kids"],
        },

        subCategory: {
            type: String,
            required: true,
            enum: ["T-Shirt", "Hoodie", "Shirt", "Pant"],
        },

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        stockBySize: {
            s: {
                type: Number,
                default: 0,
            },
            m: {
                type: Number,
                default: 0,
            },
            l: {
                type: Number,
                default: 0,
            },
            xl: {
                type: Number,
                default: 0,
            },
            xxl: {
                type: Number,
                default: 0,
            },
        },

        productColor: {
            type: String,
            required: true,
        },

        productImage: {
            type: String, // image URL
            required: true,
        },
    },
    {
        timestamps: true,
    }
);



export default mongoose.model("product", productSchema)