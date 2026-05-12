import nodemailer from "nodemailer";
import dotenv from "dotenv/config";

export const otpSent = async (otp, email) => {
  try {

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.mailUser,
        pass: process.env.mailPass,
      },
    });

    await transporter.sendMail({
      from: process.env.mailUser,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Your OTP is:</h2>
        <h1>${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      `,
    });

    // console.log("✅ OTP sent successfully");

  } catch (error) {
    // console.log("EMAIL ERROR 👉", error.message);
  }
};
