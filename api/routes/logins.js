// api/routes/logins.js
import express from "express";
import mongoose from "mongoose";
import LoginHistory from "../models/LoginHistory.js";
import { connectDB } from "../config/db.js"; // ✅ use your existing DB helper

const router = express.Router();

// --------------------------
// POST /api/logins/start
// Create new login record
// --------------------------
router.post("/logins/start", async (req, res) => {
  try {
    await connectDB();

    const { userEmail, userName } = req.body;
    if (!userEmail || !userName) {
      return res
        .status(400)
        .json({ message: "userEmail and userName are required" });
    }

    const login = await LoginHistory.create({
      userEmail,
      userName,
      loginTime: new Date(),
    });

    res.status(201).json(login.toJSON());
  } catch (err) {
    console.error("Error creating login record:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --------------------------
// POST /api/logins/end
// Optional: mark logout time (if you want to track it)
// --------------------------
router.post("/logins/end", async (req, res) => {
  try {
    await connectDB();

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const session = await LoginHistory.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // add logout field dynamically if you want
    session.logoutTime = new Date();
    await session.save();

    res.json(session.toJSON());
  } catch (err) {
    console.error("Error updating logout time:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// --------------------------
// GET /api/logins
// Get recent login records (for admin or stats)
// --------------------------
router.get("/logins", async (_req, res) => {
  try {
    await connectDB();
    const records = await LoginHistory.find().sort({ createdAt: -1 }).limit(50);
    res.json(records);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load records", error: err.message });
  }
});
router.get("/logins/all", async (_req, res) => {
  try {
    await connectDB();
    const records = await LoginHistory.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(records);
  } catch (err) {
    console.error("GET /api/logins/all error:", err);
    res.status(500).json({ message: "Failed to load login history" });
  }
});
export default router;
