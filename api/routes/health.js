// api/routes/health.js
import express from "express";
import { connectDB } from "../config/db.js";

const router = express.Router();

// 🩺 Health check route
// GET /api/health
router.get("/health", async (_, res) => {
  try {
    await connectDB();
    res.json({ ok: true, db: "connected" });
  } catch (e) {
    res.status(500).json({ ok: false, error: "DB connection failed" });
  }
});

export default router;
