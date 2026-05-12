import * as yup from "yup";


/* =======================
   Admin Register Schema
======================= */
export const adminRegisterSchema = yup.object({
  adminName: yup
    .string()
    .trim()
    .min(3, "Admin name must be at least 3 characters")
    .required("Admin name is required"),

  emailId: yup
    .string()
    .email("Invalid email format")
    .required("Email is required"),

  password: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
});

/* =======================
   Admin Login Schema
======================= */
export const adminLoginSchema = yup.object({
  emailId: yup
    .string()
    .email("Invalid email")
    .required("Email is required"),

  password: yup
    .string()
    .required("Password is required"),
});




export const validateAdmin = (schema) => async (req, res, next) => {
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

