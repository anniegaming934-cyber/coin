// api/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import LoginHistory from "../models/LoginHistory.js";
import { connectDB } from "../config/db.js";
import { ensureAdminUser } from "../utils/admin.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";

// ✅ Lazy init: connect DB + ensure admin ONCE
let adminInitialized = false;
async function ensureAdminOnce() {
  if (adminInitialized) return;

  await connectDB(); // 👈 make sure MongoDB is connected
  await ensureAdminUser(); // 👈 now safe to hit `users.findOne()`
  adminInitialized = true;
}

// -----------------------------
// POST /api/auth/register
// -----------------------------
router.post("/register", async (req, res) => {
  try {
    await ensureAdminOnce(); // DB + admin user

    const { name, email, password } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res
        .status(409)
        .json({ message: "User with that email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "user",
      isAdmin: false,
    });

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res
      .status(500)
      .json({ message: "Server error during registration" });
  }
});

// -----------------------------
// POST /api/auth/login
// -----------------------------
router.post("/login", async (req, res) => {
  try {
    await ensureAdminOnce(); // DB + admin

    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Password is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    try {
      await LoginHistory.create({
        userId: user._id,
        email: user.email,
        loggedInAt: new Date(),
      });
    } catch (err) {
      console.warn("Failed to write login history:", err.message);
    }

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// -----------------------------
// GET /api/auth/me
// -----------------------------
router.get("/me", async (req, res) => {
  try {
    await ensureAdminOnce(); // DB + admin

    const auth = req.headers.authorization || "";
    const [, token] = auth.split(" ");

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(payload.userId).select(
      "_id name email role isAdmin"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    });
  } catch (err) {
    console.error("me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
