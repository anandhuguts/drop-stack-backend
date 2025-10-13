import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = express.Router();
dotenv.config();
// Load from .env
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // hashed password from .env

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;



    // ✅ Only declare `match` once
    const match = await bcrypt.compare(password, ADMIN_PASSWORD);
    console.log("Password match:", match);

    if (email !== ADMIN_EMAIL || !match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Create token
    const token = jwt.sign(
      { role: "admin", email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
