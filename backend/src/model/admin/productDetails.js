
const productDetailsSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        type: {
            type: String,
            required: true,
        },

        functionType: {
            type: String,
            required: true,
        },

        connectivity: {
            type: String,
            required: true,
        },

        printSpeed: {
            type: String,
            required: true,
        },

        resolution: {
            type: String,
            required: true,
        },

        inkYield: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);
export default mongoose.model("productdetails", productDetailsSchema)
