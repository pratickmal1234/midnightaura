import * as yup from "yup";

/* =======================
   Delivery Boy Register Schema
======================= */
export const deliveryRegisterSchema = yup.object({
  name: yup
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .required("Name is required"),

  emailId: yup
    .string()
    .email("Invalid email format")
    .required("Email is required"),

  password: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),

  phone: yup
    .string()
    .trim()
    .matches(/^[0-9]{10}$/, "Phone number must be 10 digits")
    .required("Phone number is required"),
});

/* =======================
   Delivery Boy Login Schema
======================= */
export const deliveryLoginSchema = yup.object({
  emailId: yup
    .string()
    .email("Invalid email")
    .required("Email is required"),

  password: yup
    .string()
    .required("Password is required"),
});




export const validateDelivery = (schema) => async (req, res, next) => {
  try {
    await schema.validate(req.body, { abortEarly: false });
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      errors: err.errors,
    });
  }
};