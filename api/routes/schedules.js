import express from "express";
import { connectDB } from "../config/db.js";
import Schedule from "../models/Schedule.js";

const router = express.Router();

// ✅ Ensure DB for all routes here
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connect (schedules) failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// 🟢 GET /api/schedules
// Optional filters: ?username=abc&day=Monday
router.get("/", async (req, res) => {
  try {
    const { username, day } = req.query;
    const filter = {};

    if (username) filter.username = username;
    if (day) filter.day = day;

    const schedules = await Schedule.find(filter).sort({
      username: 1,
      day: 1,
      startTime: 1,
    });

    res.json(schedules);
  } catch (err) {
    console.error("GET /schedules error:", err);
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
});

// 🟢 GET /api/schedules/:id  (single schedule)
router.get("/:id", async (req, res) => {
  try {
    const s = await Schedule.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Schedule not found" });
    res.json(s);
  } catch (err) {
    console.error("GET /schedules/:id error:", err);
    res.status(400).json({ message: "Invalid schedule id" });
  }
});

// 🟡 POST /api/schedules  (create)
router.post("/", async (req, res) => {
  try {
    const { username, day, startTime, endTime, title } = req.body;

    if (!username || !day || !startTime || !endTime || !title) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const created = await Schedule.create({
      username,
      day,
      startTime,
      endTime,
      title,
    });

    res.json(created);
  } catch (err) {
    console.error("POST /schedules error:", err);
    res.status(400).json({ message: "Failed to create schedule" });
  }
});

// 🟠 PUT /api/schedules/:id  (update)
router.put("/:id", async (req, res) => {
  try {
    const { username, day, startTime, endTime, title } = req.body;

    const updated = await Schedule.findByIdAndUpdate(
      req.params.id,
      { username, day, startTime, endTime, title },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("PUT /schedules/:id error:", err);
    res.status(400).json({ message: "Failed to update schedule" });
  }
});

// 🔴 DELETE /api/schedules/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /schedules/:id error:", err);
    res.status(400).json({ message: "Failed to delete schedule" });
  }
});

export default router;
