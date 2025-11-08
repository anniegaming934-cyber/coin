// api/routes/logins.js
import express from "express";
import LoginHistory from "../models/LoginHistory.js";
import { connectDB } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/logins/all
 * Returns normalized login history records for the admin table
 */
router.get("/all", async (_req, res) => {
  try {
    await connectDB();

    const logs = await LoginHistory.find({})
      .sort({ loggedInAt: -1 })
      .populate("userId", "name email")
      .lean();

    // Normalize to what the frontend expects
    const mapped = logs.map((log) => ({
      _id: String(log._id),
      userId: log.userId ? String(log.userId._id) : null,
      userEmail: log.userId?.email || log.email || "",
      userName: log.userId?.name || "",
      loginTime: log.loggedInAt || log.createdAt,
      logoutTime: log.loggedOutAt || null,
      createdAt: log.createdAt,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Failed to fetch login history:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch login records", error: err.message });
  }
});

/**
 * GET /api/logins
 * Optional: basic recent raw records (not used by the admin table)
 */
router.get("/", async (_req, res) => {
  try {
    await connectDB();

    const records = await LoginHistory.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(records);
  } catch (err) {
    console.error("GET /api/logins error:", err);
    res
      .status(500)
      .json({ message: "Failed to load records", error: err.message });
  }
});

export default router;
