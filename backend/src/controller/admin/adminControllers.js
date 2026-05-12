import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import adminSchema from "../../model/admin/adminSchema.js";




export const registerAdmin = async (req, res) => {
  try {
    console.log(req.body);
    // validateuser(req.body);
    const { adminName, emailId, password } = req.body
    if(emailId){
    res.send(" Register already existing");

    }
    const hpassword = await bcrypt.hash(password, 10);
    const admin = await adminSchema.create({adminName,
      emailId,
      password: hpassword});
    res.send("user Register Successfully");

  } catch (err) {
    res.send("Error " + err.message);
  }
}


export const loginAdmin = async (req, res) => {
  try {
    const { emailId, password } = req.body;

    if (!emailId || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find admin by email
    const people = await adminSchema.findOne({ emailId });
    if (!people) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Compare passwords
    const isAllowed = await bcrypt.compare(password, people.password);
    if (!isAllowed) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: people.id, emailId: people.emailId },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("adminToken", token, { httpOnly: true, sameSite: "strict" });

    return res.status(200).json({ message: "Login Successfully", success: true });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
};

//admin profile with middleware check auth.
export const logoutAdmin = (req, res) => {
  try {

    res.clearCookie("adminToken", {
      httpOnly: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logout Successful ",
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

