import { Router } from "express";
import Schedule from "../models/Schedule.js";

const router = Router();

/**
 * GET /api/schedules
 * Optional query: ?username=john   (matches any schedule containing that username)
 */
router.get("/", async (req, res) => {
  try {
    const { username } = req.query;

    const filter = {};
    if (username) {
      filter.usernames = username; // matches if array contains this username
    }

    const items = await Schedule.find(filter).sort({ day: 1, startTime: 1 });
    res.json(items);
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({ message: "Failed to fetch schedules" });
  }
});

/**
 * POST /api/schedules
 * body: { usernames: string[], day, startTime, endTime, title }
 * startTime / endTime example: "09:00 AM"
 */
router.post("/", async (req, res) => {
  try {
    const { usernames, day, startTime, endTime, title } = req.body;

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ message: "usernames array is required" });
    }
    if (!day || !startTime || !endTime || !title) {
      return res
        .status(400)
        .json({ message: "day, startTime, endTime, title are required" });
    }

    const created = await Schedule.create({
      usernames,
      day,
      startTime,
      endTime,
      title,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating schedule:", err);
    res.status(500).json({ message: "Failed to create schedule" });
  }
});

/**
 * PUT /api/schedules/:id
 * body: { usernames: string[], day, startTime, endTime, title }
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { usernames, day, startTime, endTime, title } = req.body;

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ message: "usernames array is required" });
    }
    if (!day || !startTime || !endTime || !title) {
      return res
        .status(400)
        .json({ message: "day, startTime, endTime, title are required" });
    }

    const updated = await Schedule.findByIdAndUpdate(
      id,
      { usernames, day, startTime, endTime, title },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Error updating schedule:", err);
    res.status(500).json({ message: "Failed to update schedule" });
  }
});

/**
 * DELETE /api/schedules/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting schedule:", err);
    res.status(500).json({ message: "Failed to delete schedule" });
  }
});

export default router;
