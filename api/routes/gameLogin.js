import { Router } from "express";
import GameLogin from "../models/GameLogin.js";

const router = Router();

/**
 * GET /api/game-logins
 * Optional query: ?ownerType=admin|user
 */
router.get("/", async (req, res) => {
  try {
    const { ownerType } = req.query;

    const filter = {};
    if (ownerType === "admin" || ownerType === "user") {
      filter.ownerType = ownerType;
    }

    const items = await GameLogin.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("Error fetching game logins:", err);
    res.status(500).json({ message: "Failed to fetch game logins" });
  }
});

/**
 * POST /api/game-logins
 * body: { ownerType, gameName, loginUsername, password, gameLink? }
 */
router.post("/", async (req, res) => {
  try {
    const { ownerType, gameName, loginUsername, password, gameLink } = req.body;

    if (!ownerType || !["admin", "user"].includes(ownerType)) {
      return res.status(400).json({ message: "Invalid ownerType" });
    }
    if (!gameName || !loginUsername || !password) {
      return res.status(400).json({
        message: "gameName, loginUsername, and password are required",
      });
    }

    const created = await GameLogin.create({
      ownerType,
      gameName,
      loginUsername,
      password,
      gameLink,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating game login:", err);
    res.status(500).json({ message: "Failed to create game login" });
  }
});

/**
 * DELETE /api/game-logins/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await GameLogin.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Game login not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting game login:", err);
    res.status(500).json({ message: "Failed to delete game login" });
  }
});

export default router;
