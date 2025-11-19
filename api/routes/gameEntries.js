// api/routes/gameEntries.js
import express from "express";
import { connectDB } from "../config/db.js";
import GameEntry, {
  ALLOWED_TYPES,
  ALLOWED_METHODS,
} from "../models/GameEntry.js";
import GameEntryHistory from "../models/GameEntryHistory.js";

const router = express.Router();

// Ensure DB for all routes here
router.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ DB connect (gameEntries) failed:", err);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// helpers
function toNumber(n, def = 0) {
  if (n === undefined || n === null || n === "") return def;
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

// Normalize any date input to "YYYY-MM-DD" string (or undefined)
function normalizeDateString(d) {
  if (!d) return undefined;
  if (typeof d === "string") {
    // already "YYYY-MM-DD" or ISO -> just slice first 10
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const date = new Date(d);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    return undefined;
  }
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

// Small helper to record history
async function recordHistory(entry, action = "update") {
  try {
    if (!entry) return;

    await GameEntryHistory.create({
      entryId: entry._id,
      username: entry.username,
      createdBy: entry.createdBy,

      type: entry.type,
      method: entry.method,

      playerName: entry.playerName,
      playerTag: entry.playerTag,
      gameName: entry.gameName,

      amountBase: entry.amountBase,
      amount: entry.amount,
      bonusRate: entry.bonusRate,
      bonusAmount: entry.bonusAmount,
      amountFinal: entry.amountFinal,

      totalPaid: entry.totalPaid,
      totalCashout: entry.totalCashout,
      remainingPay: entry.remainingPay,
      extraMoney: entry.extraMoney,
      reduction: entry.reduction,

      isPending: entry.isPending,
      date: entry.date,
      note: entry.note,

      action,
      snapshot: entry.toObject(),
    });
  } catch (err) {
    console.error("⚠️ Failed to record GameEntry history:", err.message || err);
  }
}

/**
 * 🔹 GET /api/game-entries
 * Optional query:
 *   username, type, method, gameName, playerTag, dateFrom, dateTo
 */
router.get("/", async (req, res) => {
  try {
    const { username, type, method, gameName, playerTag, dateFrom, dateTo } =
      req.query;

    const filter = {};

    if (username && String(username).trim()) {
      filter.username = String(username).trim();
    }

    if (type && ALLOWED_TYPES.includes(String(type))) {
      filter.type = String(type);
    }

    if (method && ALLOWED_METHODS.includes(String(method))) {
      filter.method = String(method);
    }

    if (gameName && String(gameName).trim()) {
      filter.gameName = String(gameName).trim();
    }

    if (playerTag && String(playerTag).trim()) {
      filter.playerTag = String(playerTag).trim();
    }

    // date range filter (stored as "YYYY-MM-DD")
    const from = normalizeDateString(dateFrom);
    const to = normalizeDateString(dateTo);

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const docs = await GameEntry.find(filter).sort({ createdAt: -1 }).lean();

    res.json(docs);
  } catch (err) {
    console.error("❌ GET /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to load game entries" });
  }
});

/**
 * 🔹 POST /api/game-entries
 */
router.post("/", async (req, res) => {
  try {
    const {
      username,
      createdBy,
      type,
      method,
      playerName,
      playerTag,
      gameName,
      amountBase,
      amount,
      bonusRate,
      bonusAmount,
      amountFinal,
      date,
      note,
      totalPaid,
      totalCashout,
      remainingPay,
      extraMoney,
      reduction,
      isPending,
    } = req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({ message: "username is required" });
    }
    if (!createdBy || !String(createdBy).trim()) {
      return res.status(400).json({ message: "createdBy is required" });
    }
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }
    if (["deposit", "redeem"].includes(type)) {
      if (!method || !ALLOWED_METHODS.includes(method)) {
        return res.status(400).json({ message: "Invalid or missing method" });
      }
    }

    if (!gameName || !String(gameName).trim()) {
      return res.status(400).json({ message: "gameName is required" });
    }

    const base = toNumber(amountBase, NaN);
    if (!Number.isFinite(base) || base < 0) {
      return res.status(400).json({ message: "Invalid amountBase" });
    }

    const final = toNumber(amountFinal, NaN);
    if (!Number.isFinite(final) || final < 0) {
      return res.status(400).json({ message: "Invalid amountFinal" });
    }

    const doc = await GameEntry.create({
      username: String(username).trim(),
      createdBy: String(createdBy).trim(),
      type,
      method: method || undefined,

      playerName: playerName || "",
      playerTag: playerTag || "",
      gameName: String(gameName).trim(),

      amountBase: base,
      amount: amount != null ? toNumber(amount, 0) : final,
      bonusRate: toNumber(bonusRate, 0),
      bonusAmount: toNumber(bonusAmount, 0),
      amountFinal: final,

      date: normalizeDateString(date),
      note: note || "",

      totalPaid: toNumber(totalPaid, 0),
      totalCashout: toNumber(totalCashout, 0),
      remainingPay: toNumber(remainingPay, 0),
      extraMoney: toNumber(extraMoney, 0),
      reduction: toNumber(reduction, 0),
      isPending: Boolean(isPending),
    });

    await recordHistory(doc, "create");

    res.status(201).json(doc);
  } catch (err) {
    console.error("❌ POST /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to create game entry" });
  }
});

/**
 * 🔹 GET /api/game-entries/pending
 * Returns pending redeems (optionally filtered by username)
 * Used for: username, time, playerName, game, totalPaid, totalRemaining
 */
/**
 * 🔹 GET /api/game-entries/pending
 * Returns pending redeems (optionally filtered by username)
 * Used for: username, time, playerName, game, totalPaid, totalRemaining
 */
router.get("/pending", async (req, res) => {
  try {
    const { username } = req.query;

    // base filter: only pending redeems
    const filter = {
      type: "redeem",
      isPending: true,
    };

    // optional username filter
    if (username && String(username).trim()) {
      filter.username = String(username).trim();
    }

    const entries = await GameEntry.find(filter).sort({ createdAt: -1 }).lean();

    const result = entries.map((e) => {
      const totalPaid = toNumber(e.totalPaid ?? 0, 0);
      const totalCashout = toNumber(e.totalCashout ?? e.amountFinal ?? 0, 0);
      const remainingPay = toNumber(
        e.remainingPay ?? totalCashout - totalPaid,
        0
      );

      return {
        _id: String(e._id),
        username: e.username,

        // 👇 now clearly separated
        playerName: e.playerName || "",
        playerTag: e.playerTag || "",

        gameName: e.gameName,
        method: e.method || "",
        totalPaid,
        totalCashout,
        remainingPay,
        date:
          e.date ||
          (e.createdAt
            ? new Date(e.createdAt).toISOString().slice(0, 10)
            : undefined),
        createdAt: e.createdAt
          ? new Date(e.createdAt).toISOString()
          : undefined,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ GET /api/game-entries/pending error:", err);
    return res
      .status(500)
      .json({ message: "Failed to load pending game entries" });
  }
});

/**
 * 🔹 GET /api/game-entries/pending-by-tag
 */
router.get("/pending-by-tag", async (req, res) => {
  try {
    const { playerTag, username } = req.query;

    const cleanTag = String(playerTag || "").trim();
    const cleanUser = String(username || "").trim();

    if (!cleanTag || !cleanUser) {
      return res
        .status(400)
        .json({ message: "playerTag and username are required" });
    }

    const agg = await GameEntry.aggregate([
      {
        $match: {
          username: cleanUser,
          playerTag: cleanTag,
          type: "redeem",
          isPending: true,
        },
      },
      {
        $group: {
          _id: null,
          totalCashout: { $sum: { $ifNull: ["$totalCashout", 0] } },
          totalPaid: { $sum: { $ifNull: ["$totalPaid", 0] } },
          remainingPay: { $sum: { $ifNull: ["$remainingPay", 0] } },
        },
      },
    ]);

    if (!agg.length) {
      return res.status(404).json({ message: "No pending for this tag" });
    }

    const row = agg[0];

    return res.json({
      playerTag: cleanTag,
      totalCashout: row.totalCashout || 0,
      totalPaid: row.totalPaid || 0,
      remainingPay: row.remainingPay || 0,
    });
  } catch (err) {
    console.error("❌ GET /api/game-entries/pending-by-tag error:", err);
    return res
      .status(500)
      .json({ message: "Failed to load pending info for this tag" });
  }
});

/**
 * 🔹 GET /api/game-entries/summary
 */
/**
 * 🔹 GET /api/game-entries/summary
 * Global totals + deposit revenue split by payment method
 */
router.get("/summary", async (_req, res) => {
  try {
    // -------------------------
    // 1️⃣ TOTALS BY TYPE
    // -------------------------
    const byType = await GameEntry.aggregate([
      {
        $group: {
          _id: "$type",
          totalAmountFinal: { $sum: { $ifNull: ["$amountFinal", 0] } },
        },
      },
    ]);

    let totalFreeplay = 0;
    let totalDeposit = 0;
    let totalRedeem = 0;

    for (const t of byType) {
      if (t._id === "freeplay") totalFreeplay = t.totalAmountFinal;
      if (t._id === "deposit") totalDeposit = t.totalAmountFinal;
      if (t._id === "redeem") totalRedeem = t.totalAmountFinal;
    }

    const totalCoin = totalFreeplay + totalDeposit + totalRedeem;

    // -------------------------
    // 2️⃣ TOTAL PENDING
    // -------------------------
    const [pendingAgg] = await GameEntry.aggregate([
      { $match: { isPending: true } },
      {
        $group: {
          _id: null,
          totalPendingRemainingPay: { $sum: { $ifNull: ["$remainingPay", 0] } },
          totalPendingCount: { $sum: 1 },
        },
      },
    ]);

    // -------------------------
    // 3️⃣ REDUCTION + EXTRA MONEY
    // -------------------------
    const [extraAgg] = await GameEntry.aggregate([
      {
        $group: {
          _id: null,
          totalReduction: { $sum: { $ifNull: ["$reduction", 0] } },
          totalExtraMoney: { $sum: { $ifNull: ["$extraMoney", 0] } },
        },
      },
    ]);

    // -------------------------
    // 4️⃣ REVENUE BY DEPOSIT METHOD
    // -------------------------
    const depositByMethod = await GameEntry.aggregate([
      { $match: { type: "deposit" } },
      {
        $group: {
          _id: "$method",
          totalAmountFinal: { $sum: { $ifNull: ["$amountFinal", 0] } },
        },
      },
    ]);

    // Start at 0
    let revenueCashApp = 0;
    let revenuePayPal = 0;
    let revenueChime = 0;
    let revenueVenmo = 0;

    for (const row of depositByMethod) {
      if (row._id === "cashapp") revenueCashApp = row.totalAmountFinal;
      if (row._id === "paypal") revenuePayPal = row.totalAmountFinal;
      if (row._id === "chime") revenueChime = row.totalAmountFinal;
      if (row._id === "venmo") revenueVenmo = row.totalAmountFinal;
    }

    // -------------------------
    // 5️⃣ FINAL RESPONSE
    // -------------------------
    res.json({
      totalFreeplay,
      totalDeposit,
      totalRedeem,
      totalCoin,

      totalPendingRemainingPay: pendingAgg?.totalPendingRemainingPay || 0,
      totalPendingCount: pendingAgg?.totalPendingCount || 0,

      totalReduction: extraAgg?.totalReduction || 0,
      totalExtraMoney: extraAgg?.totalExtraMoney || 0,

      // 🌟 NEW: Deposit Revenue by Method
      revenueCashApp,
      revenuePayPal,
      revenueChime,
      revenueVenmo,
    });
  } catch (err) {
    console.error("❌ GET /api/game-entries/summary error:", err);
    res.status(500).json({ message: "Failed to load game entry summary" });
  }
});

/**
 * 🔹 GET /api/game-entries/:id/history
 */
router.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;

    const docs = await GameEntryHistory.find({ entryId: id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(docs);
  } catch (err) {
    console.error("❌ GET /api/game-entries/:id/history error:", err);
    res.status(500).json({ message: "Failed to load entry history" });
  }
});

/**
 * 🔹 PUT /api/game-entries/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await GameEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Game entry not found" });
    }

    const payload = req.body;

    if (payload.type && !ALLOWED_TYPES.includes(payload.type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    if (payload.method && !ALLOWED_METHODS.includes(payload.method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    if (payload.amountBase !== undefined) {
      const base = toNumber(payload.amountBase, NaN);
      if (!Number.isFinite(base) || base < 0) {
        return res.status(400).json({ message: "Invalid amountBase" });
      }
      entry.amountBase = base;
    }

    if (payload.amountFinal !== undefined) {
      const final = toNumber(payload.amountFinal, NaN);
      if (!Number.isFinite(final) || final < 0) {
        return res.status(400).json({ message: "Invalid amountFinal" });
      }
      entry.amountFinal = final;
    }

    const simpleFields = [
      "username",
      "createdBy",
      "type",
      "method",
      "playerName",
      "playerTag",
      "gameName",
      "amount",
      "bonusRate",
      "bonusAmount",
      "note",
      "totalPaid",
      "totalCashout",
      "remainingPay",
      "extraMoney",
      "reduction",
      "isPending",
    ];

    for (const field of simpleFields) {
      if (payload[field] !== undefined) {
        if (
          [
            "amount",
            "bonusRate",
            "bonusAmount",
            "totalPaid",
            "totalCashout",
            "remainingPay",
            "extraMoney",
            "reduction",
          ].includes(field)
        ) {
          entry[field] = toNumber(payload[field], 0);
        } else {
          entry[field] = payload[field];
        }
      }
    }

    if (payload.date !== undefined) {
      entry.date = normalizeDateString(payload.date);
    }

    await entry.save();
    await recordHistory(entry, "update");

    res.json(entry);
  } catch (err) {
    console.error("❌ PUT /api/game-entries/:id error:", err);
    res.status(500).json({ message: "Failed to update game entry" });
  }
});

/**
 * 🔹 DELETE /api/game-entries/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await GameEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Game entry not found" });
    }

    await recordHistory(entry, "delete");
    await entry.deleteOne();

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ DELETE /api/game-entries/:id error:", err);
    res.status(500).json({ message: "Failed to delete game entry" });
  }
});

export default router;
