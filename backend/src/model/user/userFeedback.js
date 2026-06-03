import mongoose from "mongoose";

// Image Feedback
const imageFeedbackSchema = new mongoose.Schema(
  {
    imageData: {
      type: String,
      required: true,
    },
    imageComment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

// Comment Feedback
const commentFeedbackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
    },

    productId: {
      type: String,
      required: true,
      index: true,
    },

    customerId: {
      type: String,
      required: true,
      index: true,
    },

    feedbackType: {
      type: String,
      enum: ["comment", "image"],
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    commentFeedback: {
      type: commentFeedbackSchema,
      default: null,
    },

    imageFeedback: {
      type: imageFeedbackSchema,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// REMOVE THIS
// feedbackSchema.index({ orderId: 1, customerId: 1 }, { unique: true });

feedbackSchema.index({
  productId: 1,
  submittedAt: -1,
});

export default mongoose.model("Feedback", feedbackSchema);