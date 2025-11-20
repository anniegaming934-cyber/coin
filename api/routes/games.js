// api/routes/games.js
import express from "express";
import { connectDB } from "../config/db.js";
import Game from "../models/Game.js";
import GameEntry from "../models/GameEntry.js"; // ✅ needed for aggregate
import UserActivity from "../models/UserActivity.js";
import { safeNum } from "../utils/numbers.js";

const router = express.Router();

/**
 * If mounted as:
 *   app.use("/api", gameRoutes)
 *
 * Routes:
 *   GET    /api/games                 -> with ?q= returns string[] (names), else enriched Game[]
 *   POST   /api/games
 *   PUT    /api/games/:id
 *   DELETE /api/games/:id
 *   POST   /api/games/:id/add-moves   -> logs UserActivity only
 *   POST   /api/games/:id/reset-recharge
 */

// GET /api/games  (names suggest when ?q= provided; else full list)
router.get("/games", async (req, res) => {
  try {
    await connectDB();

    const q = (req.query.q || "").toString().trim();

    // If searching -> return names only
    if (q) {
      const filter = { name: { $regex: q, $options: "i" } };
      const names = await Game.distinct("name", filter);
      const sorted = names
        .filter((n) => typeof n === "string" && n.trim().length > 0)
        .sort((a, b) => a.localeCompare(b));
      return res.json(sorted);
    }

    // 1) Load all games
    const games = await Game.find({}).sort({ createdAt: 1 }).lean();

    const gameNames = games
      .map((g) => g.name)
      .filter((n) => typeof n === "string" && n.trim().length > 0);

    // 2) Aggregate GameEntry totals for each game
    const totals = await GameEntry.aggregate([
      { $match: { gameName: { $in: gameNames } } },
      {
        $group: {
          _id: "$gameName",
          freeplay: {
            $sum: {
              $cond: [
                { $eq: ["$type", "freeplay"] },
                { $ifNull: ["$amountFinal", "$amount"] },
                0,
              ],
            },
          },
          deposit: {
            $sum: {
              $cond: [
                { $eq: ["$type", "deposit"] },
                { $ifNull: ["$amountFinal", "$amount"] },
                0,
              ],
            },
          },
          redeem: {
            $sum: {
              $cond: [
                { $eq: ["$type", "redeem"] },
                { $ifNull: ["$amountFinal", "$amount"] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalsByGame = {};
    for (const t of totals) {
      totalsByGame[t._id] = {
        freeplay: t.freeplay || 0,
        deposit: t.deposit || 0,
        redeem: t.redeem || 0,
      };
    }

    // 3) Merge totals + compute totalCoins (recharge + redeem - deposit - freeplay)
    const enriched = games.map((g) => {
      const s = totalsByGame[g.name] || {
        freeplay: 0,
        deposit: 0,
        redeem: 0,
      };

      // Make sure this is a safe number
      const coinsRecharged = Number(g.coinsRecharged) || 0;

      // Step 1: start from recharge
      let totalCoins = coinsRecharged;

      // Step 2: add redeem
      totalCoins += s.redeem;

      // Step 3: subtract deposit
      totalCoins -= s.deposit;
      if (totalCoins < 0) totalCoins = 0;

      // Step 4: subtract freeplay from remaining
      totalCoins -= s.freeplay;
      if (totalCoins < 0) totalCoins = 0;

      return {
        ...g,
        freeplay: s.freeplay,
        deposit: s.deposit,
        redeem: s.redeem,
        coinsRecharged,
        totalCoins,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("GET /api/games error:", err);
    res.status(500).json({ message: "Failed to load games" });
  }
});

// POST /api/games  (create new game)
router.post("/games", async (req, res) => {
  const { name, coinsRecharged = 0, lastRechargeDate = null } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Game name is required" });
  }

  try {
    await connectDB();

    // Optional: prevent duplicate names (comment out if you allow duplicates)
    const exists = await Game.findOne({ name }).lean();
    if (exists) {
      return res
        .status(409)
        .json({ message: "Game with this name already exists" });
    }

    const newGame = await Game.create({
      id: Date.now(), // numeric id used by frontend
      name,
      coinsRecharged,
      lastRechargeDate,
    });

    res.status(201).json(newGame);
  } catch (err) {
    console.error("POST /api/games error:", err);
    res.status(500).json({ message: "Failed to create game" });
  }
});

// PUT /api/games/:id  (update recharge & lastRechargeDate)
router.put("/games/:id", async (req, res) => {
  const { id } = req.params;
  const { coinsRecharged, lastRechargeDate, totalCoins } = req.body;

  try {
    await connectDB();

    const game = await Game.findOne({ id: Number(id) });
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (typeof coinsRecharged === "number") {
      game.coinsRecharged = coinsRecharged;
    }

    if (lastRechargeDate !== undefined) {
      game.lastRechargeDate = lastRechargeDate;
    }

    if (typeof totalCoins === "number") {
      game.totalCoins = totalCoins;
    }

    await game.save();

    res.json(game);
  } catch (err) {
    console.error("PUT /api/games/:id error:", err);
    res.status(500).json({ message: "Failed to update game" });
  }
});

// DELETE /api/games/:id
router.delete("/games/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await connectDB();

    const result = await Game.findOneAndDelete({ id: Number(id) }).lean();
    if (!result) return res.status(404).json({ message: "Game not found" });

    res.json(result);
  } catch (err) {
    console.error("DELETE /api/games/:id error:", err);
    res.status(500).json({ message: "Failed to delete game" });
  }
});

// POST /api/games/:id/add-moves
// Now this ONLY logs UserActivity. It no longer mutates Game coin fields.
router.post("/games/:id/add-moves", async (req, res) => {
  const { id } = req.params;
  const {
    freeplayDelta = 0,
    redeemDelta = 0,
    depositDelta = 0,
    username = "Unknown User",
    freeplayTotal,
    redeemTotal,
    depositTotal,
  } = req.body;

  try {
    await connectDB();

    const game = await Game.findOne({ id: Number(id) });
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const freeplay = safeNum(freeplayDelta);
    const redeem = safeNum(redeemDelta);
    const deposit = safeNum(depositDelta);

    // 🔹 We NO LONGER change any game.coinsXXX here, because
    // totals are computed from GameEntry + coinsRecharged.

    // Update last recharge date only if there was a deposit
    if (deposit > 0) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      game.lastRechargeDate = `${yyyy}-${mm}-${dd}`;
      await game.save();
    }

    // Log user activity
    if (freeplay || redeem || deposit) {
      await UserActivity.create({
        username,
        gameId: game.id,
        gameName: game.name,
        freeplay,
        redeem,
        deposit,
        freeplayTotal:
          typeof freeplayTotal === "number" ? freeplayTotal : undefined,
        redeemTotal: typeof redeemTotal === "number" ? redeemTotal : undefined,
        depositTotal:
          typeof depositTotal === "number" ? depositTotal : undefined,
      });
    }

    return res.json({
      message: "Moves logged",
      game,
    });
  } catch (err) {
    console.error("POST /api/games/:id/add-moves error:", err);
    return res.status(500).json({ message: "Failed to update game moves" });
  }
});

// POST /api/games/:id/reset-recharge
router.post("/games/:id/reset-recharge", async (req, res) => {
  const { id } = req.params;

  try {
    await connectDB();

    const game = await Game.findOneAndUpdate(
      { id: Number(id) },
      { $set: { coinsRecharged: 0, lastRechargeDate: null } },
      { new: true }
    ).lean();

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json(game);
  } catch (err) {
    console.error("POST /api/games/:id/reset-recharge error:", err);
    res.status(500).json({ message: "Failed to reset game recharge" });
  }
});

export default router;
