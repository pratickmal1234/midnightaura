import admin from "../config/firebaseAdmin.js";
import User  from "../model/user/userSchema.js";

export const sendNotification = async (customerId, title, body, data = {}) => {
  try {
    // Fetch user's stored FCM tokens
    const user = await User.findOne({ customerId }).lean();
    console.log("User : ",user);
    if (!user?.fcmTokens?.length) return;

    const response = await admin.messaging().sendEachForMulticast({
      tokens:       user.fcmTokens,
      notification: { title, body },
      data,         // optional extra key-value payload
      webpush: {
        notification: {
          title,
          body,
          icon: "https://yoursite.com/logo.png",
        },
      },
    });

    console.log(`✅ Sent: ${response.successCount}, ❌ Failed: ${response.failureCount}`);

    // Remove expired/invalid tokens from DB
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) invalidTokens.push(user.fcmTokens[idx]);
    });

    if (invalidTokens.length) {
      await User.findOneAndUpdate(
        { customerId },
        { $pull: { fcmTokens: { $in: invalidTokens } } }
      );
    }
  } catch (error) {
    console.error("sendNotification error:", error.message);
  }
};