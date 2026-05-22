import productSchema from "../../model/admin/productSchema.js";

export const addProduct = async (req, res) => {
    try {
        const {
            productName,
            category,
            subCategory,
            price,
            stockBySize,
            productColor,
            productImage,
        } = req.body;

        // validation
        if (
            !productName ||
            !category ||
            !subCategory ||
            !price ||
            !productColor ||
            !productImage
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const newProduct = new productSchema({
            productName,
            category,
            subCategory,
            price,
            stockBySize,
            productColor,
            productImage,
        });

        await newProduct.save();

        res.status(201).json({
            success: true,
            message: "Product added successfully",
            product: newProduct,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ======================
// UPDATE PRODUCT
// ======================

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedProduct = await productSchema.findByIdAndUpdate(
            id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product: updatedProduct,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};