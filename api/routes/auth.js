// api/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { ensureAdminUser } from "../utils/admin.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

// ✅ Use the SAME secret everywhere (login, requireAdmin, requireAuth)
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";

// Ensure DB + admin exists (safe guards)
router.use(async (_req, _res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("❌ connectDB in auth router failed:", err);
  }
  try {
    await ensureAdminUser();
  } catch (err) {
    console.error("❌ ensureAdminUser failed:", err);
  }
  next();
});

/**
 * 🔐 Generic auth middleware for logged-in users
 * Reads Authorization: Bearer <token>
 * Attaches req.user
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ message: "Missing or invalid auth header" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // payload.userId comes from login below
    const user = await User.findById(payload.userId).select(
      "_id name username email role isAdmin"
    );

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("requireAuth error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, username } = req.body;

    // 🔹 Trim only, NO lowercasing → keep exact user case
    const rawEmail = (email || "").trim();

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // ✅ Case-sensitive uniqueness: same case must not exist
    const existing = await User.findOne({ email: rawEmail });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username || rawEmail.split("@")[0],
      name: name || "User",
      email: rawEmail, // 🔹 store as typed (with case)
      passwordHash,
      role: "user",
      isAdmin: false,
    });

    res.status(201).json({
      message: "User registered",
      user: { id: user._id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 🔹 Same: trim only, keep case
    const rawEmail = (email || "").trim();

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // 🔥 CASE-SENSITIVE lookup: Mongo string match is case-sensitive by default
    const user = await User.findOne({ email: rawEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // (Optional extra strict check – redundant, but explicit)
    if (user.email !== rawEmail) {
      return res
        .status(401)
        .json({ message: "Email case does not match our records" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 👇 IMPORTANT: userId matches requireAuth / requireAdmin
    const payload = {
      userId: user._id.toString(),
      role: user.role,
      isAdmin: user.isAdmin,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email, // 👈 this is the canonical, case-sensitive value
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/auth/me
 * Used by frontend on reload to keep the user logged in.
 */
router.get("/me", requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    user: {
      id: u._id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      isAdmin: u.isAdmin,
    },
  });
});

export default router;
