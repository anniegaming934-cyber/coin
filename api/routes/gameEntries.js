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
 * Body: {
 *   username, createdBy,
 *   type, method?,
 *   playerName?, playerTag?, gameName,
 *   amountBase, amount?, bonusRate?, bonusAmount?, amountFinal,
 *   date?, note?,
 *   totalPaid?, totalCashout?, remainingPay?, extraMoney?, reduction?, isPending?
 * }
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

    // Generic assign for simple fields
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
// 👇 ADD THIS in api/routes/gameEntries.js

// 🔹 GET /api/game-entries/summary
// Returns totals by type + extra info
router.get("/summary", async (_req, res) => {
  try {
    // Group by type (freeplay, deposit, redeem)
    const byType = await GameEntry.aggregate([
      {
        $group: {
          _id: "$type",
          totalAmountFinal: { $sum: "$amountFinal" },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalFreeplay = 0;
    let totalDeposit = 0;
    let totalRedeem = 0;

    for (const row of byType) {
      if (row._id === "freeplay") totalFreeplay = row.totalAmountFinal || 0;
      if (row._id === "deposit") totalDeposit = row.totalAmountFinal || 0;
      if (row._id === "redeem") totalRedeem = row.totalAmountFinal || 0;
    }

    const totalCoin = totalFreeplay + totalDeposit + totalRedeem;

    // Pending remainingPay
    const [pendingAgg] = await GameEntry.aggregate([
      { $match: { isPending: true } },
      {
        $group: {
          _id: null,
          totalPendingRemainingPay: { $sum: "$remainingPay" },
        },
      },
    ]);

    // Reduction + extraMoney (optional, but useful)
    const [extraAgg] = await GameEntry.aggregate([
      {
        $group: {
          _id: null,
          totalReduction: { $sum: "$reduction" },
          totalExtraMoney: { $sum: "$extraMoney" },
        },
      },
    ]);

    // 🔹 Deposit totals by method (cashapp, paypal, chime, etc.)
    const depositByMethod = await GameEntry.aggregate([
      { $match: { type: "deposit" } },
      {
        $group: {
          _id: "$method",
          totalAmountFinal: { $sum: "$amountFinal" },
        },
      },
    ]);

    let cashappDeposit = 0;
    let paypalDeposit = 0;
    let chimeDeposit = 0;
    let venmoDeposit = 0;

    for (const row of depositByMethod) {
      if (row._id === "cashapp") cashappDeposit = row.totalAmountFinal || 0;
      if (row._id === "paypal") paypalDeposit = row.totalAmountFinal || 0;
      if (row._id === "chime") chimeDeposit = row.totalAmountFinal || 0;
      if (row._id === "venmo") venmoDeposit = row.totalAmountFinal || 0;
    }

    // Optionally, also keep a generic object if you add more methods later:
    const depositByMethodMap = depositByMethod.reduce((acc, row) => {
      acc[row._id || "unknown"] = row.totalAmountFinal || 0;
      return acc;
    }, {});

    res.json({
      totalCoin,
      totalFreeplay,
      totalDeposit,
      totalRedeem,
      totalPendingRemainingPay: pendingAgg?.totalPendingRemainingPay || 0,
      totalReduction: extraAgg?.totalReduction || 0,
      totalExtraMoney: extraAgg?.totalExtraMoney || 0,

      // 🔹 New fields
      cashappDeposit,
      paypalDeposit,
      chimeDeposit,
      venmoDeposit,
      depositByMethod: depositByMethodMap,
    });
  } catch (err) {
    console.error("❌ GET /api/game-entries/summary error:", err);
    res.status(500).json({ message: "Failed to load game entry summary" });
  }
});

export default router;
