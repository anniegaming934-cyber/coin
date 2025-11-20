import express from "express";
import { connectDB } from "../config/db.js";
import Schedule from "../models/Schedule.js";

const router = express.Router();

// ensure database is connected
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// 📌 GET all schedules
router.get("/", async (req, res) => {
  try {
    const { username } = req.query; // optional per-user filter
    const schedules = await Schedule.find(username ? { username } : {}).sort({
      day: 1,
      startTime: 1,
    });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
});

// 📌 POST create a schedule
router.post("/", async (req, res) => {
  try {
    const { day, startTime, endTime, title, username } = req.body;

    const created = await Schedule.create({
      day,
      startTime,
      endTime,
      title,
      username,
    });

    res.json(created);
  } catch (err) {
    res.status(400).json({ message: "Failed to create schedule" });
  }
});

// 📌 PUT update schedule
router.put("/:id", async (req, res) => {
  try {
    const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update schedule" });
  }
});

// 📌 DELETE schedule
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(400).json({ message: "Failed to delete schedule" });
  }
});

export default router;
