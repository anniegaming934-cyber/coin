// api/routes/gameEntries.js
import express from "express";
import { connectDB } from "../config/db.js";
import GameEntry, {
  ALLOWED_TYPES,
  ALLOWED_METHODS,
} from "../models/GameEntry.js";
import GameEntryHistory from "../models/GameEntryHistory.js";
import Game from "../models/Game.js"; // for totalCoins updates

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

// For aggregations: prefer amountFinal, then amount, then 0
const COIN_AMOUNT_EXPR = {
  $ifNull: ["$amountFinal", { $ifNull: ["$amount", 0] }],
};

// ⭐ how much this entry changes totalCoins
function coinEffect(type, amountFinal) {
  const amt = Number(amountFinal);
  if (!Number.isFinite(amt) || amt <= 0) return 0;

  // freeplay + deposit → minus
  // redeem            → plus
  if (type === "deposit" || type === "freeplay") return -amt;
  if (type === "redeem") return amt;
  return 0;
}

// ⭐ apply a delta to Game.totalCoins
async function applyGameDelta(gameName, delta) {
  try {
    const name = String(gameName || "").trim();
    if (!name) return;

    const game = await Game.findOne({ name });
    if (!game) return; // silently ignore if no game found

    const current = Number(game.totalCoins || 0);
    game.totalCoins = current + delta;
    await game.save();
  } catch (err) {
    console.error("⚠️ Failed to update Game.totalCoins:", err);
  }
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

// ⭐ Build monthly filter on createdAt (Date)
function buildMonthFilter(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return {};
  }

  const start = new Date(y, m - 1, 1); // inclusive
  const end = new Date(y, m, 1); // exclusive

  return { createdAt: { $gte: start, $lt: end } };
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

    // date range filter (stored as "YYYY-MM-DD" string)
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

    // ⭐ Update Game.totalCoins using type and amountFinal
    const delta = coinEffect(doc.type, doc.amountFinal);
    if (delta !== 0) {
      await applyGameDelta(doc.gameName, delta);
    }

    res.status(201).json(doc);
  } catch (err) {
    console.error("❌ POST /api/game-entries error:", err);
    res.status(500).json({ message: "Failed to create game entry" });
  }
});

/**
 * 🔹 GET /api/game-entries/pending
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
 * Global totals + deposit revenue split by payment method (monthly via createdAt)
 */
// 🔹 GET /api/game-entries/summary
//     /api/game-entries/summary?year=2024&month=8
/**
 * 🔹 GET /api/game-entries/summary
 * Global totals + deposit revenue split by payment method
 * Supports:
 *   - /api/game-entries/summary             → all time
 *   - /api/game-entries/summary?year=2024&month=8  → that month only (using `date` string)
 */
// 🔹 GET /api/game-entries/summary
//     /api/game-entries/summary?year=2024&month=8
//     /api/game-entries/summary?year=2024&month=8&day=15
router.get("/summary", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10); // 1–12
    const day = req.query.day ? parseInt(req.query.day, 10) : NaN; // 1–31 (optional)

    // 1) Build filter using date string "YYYY-MM-DD"
    let dateFilter = {};
    if (
      !Number.isNaN(year) &&
      !Number.isNaN(month) &&
      month >= 1 &&
      month <= 12
    ) {
      const mm = String(month).padStart(2, "0");

      // If day is valid -> filter specific day
      if (!Number.isNaN(day) && day >= 1 && day <= 31) {
        const dd = String(day).padStart(2, "0");
        const targetDate = `${year}-${mm}-${dd}`; // e.g. "2024-08-15"
        dateFilter = { date: targetDate };
      } else {
        // Otherwise filter whole month
        const prefix = `${year}-${mm}`; // e.g. "2024-08"
        dateFilter = { date: { $regex: `^${prefix}` } };
      }
    }

    // Debug so you can see what’s really happening
    console.log("SUMMARY query:", req.query);
    console.log("SUMMARY dateFilter:", JSON.stringify(dateFilter));

    // 2) Totals by type (coins)
    const byType = await GameEntry.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$type",
          totalAmount: {
            $sum: {
              $cond: [
                // deposit uses amountFinal (coins)
                { $eq: ["$type", "deposit"] },
                { $ifNull: ["$amountFinal", 0] },

                // freeplay + redeem use amountFinal/amount
                {
                  $ifNull: ["$amountFinal", { $ifNull: ["$amount", 0] }],
                },
              ],
            },
          },
        },
      },
    ]);

    let totalFreeplay = 0;
    let totalDeposit = 0;
    let totalRedeem = 0;

    for (const t of byType) {
      if (t._id === "freeplay") totalFreeplay = t.totalAmount || 0;
      if (t._id === "deposit") totalDeposit = t.totalAmount || 0;
      if (t._id === "redeem") totalRedeem = t.totalAmount || 0;
    }

    const totalCoin = totalRedeem - (totalFreeplay + totalDeposit);

    // 3) Pending
    const [pendingAgg] = await GameEntry.aggregate([
      { $match: { isPending: true, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalPendingRemainingPay: { $sum: { $ifNull: ["$remainingPay", 0] } },
          totalPendingCount: { $sum: 1 },
        },
      },
    ]);

    // 4) Reduction + extra money
    const [extraAgg] = await GameEntry.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalReduction: { $sum: { $ifNull: ["$reduction", 0] } },
          totalExtraMoney: { $sum: { $ifNull: ["$extraMoney", 0] } },
        },
      },
    ]);

    // 5) Real-money revenue per method
    const depositByMethod = await GameEntry.aggregate([
      { $match: { type: "deposit", ...dateFilter } },
      {
        $group: {
          _id: "$method",
          totalAmount: { $sum: { $ifNull: ["$amountBase", 0] } },
        },
      },
    ]);

    let revenueCashApp = 0,
      revenuePayPal = 0,
      revenueChime = 0,
      revenueVenmo = 0;

    for (const row of depositByMethod) {
      if (row._id === "cashapp") revenueCashApp = row.totalAmount || 0;
      if (row._id === "paypal") revenuePayPal = row.totalAmount || 0;
      if (row._id === "chime") revenueChime = row.totalAmount || 0;
      if (row._id === "venmo") revenueVenmo = row.totalAmount || 0;
    }

    const totalRevenue =
      revenueCashApp + revenuePayPal + revenueChime + revenueVenmo;

    res.json({
      totalFreeplay,
      totalDeposit,
      totalRedeem,
      totalCoin,
      totalPendingRemainingPay: pendingAgg?.totalPendingRemainingPay || 0,
      totalPendingCount: pendingAgg?.totalPendingCount || 0,
      totalReduction: extraAgg?.totalReduction || 0,
      totalExtraMoney: extraAgg?.totalExtraMoney || 0,
      revenueCashApp,
      revenuePayPal,
      revenueChime,
      revenueVenmo,
      totalRevenue,
    });
  } catch (err) {
    console.error("❌ GET /api/game-entries/summary error:", err);
    res.status(500).json({ message: "Failed to load summary" });
  }
});

/**
 * 🔹 GET /api/game-entries/summary-by-game
 *    → supports ?year=YYYY&month=MM (monthly per-game summary)
 */
router.get("/summary-by-game", async (req, res) => {
  try {
    const { username, year, month } = req.query;

    const match = {};
    if (username && String(username).trim()) {
      match.username = String(username).trim();
    }

    const createdAtFilter = buildMonthFilter(year, month);

    console.log("📊 /summary-by-game params:", req.query);
    console.log("📊 /summary-by-game createdAtFilter:", createdAtFilter);

    const agg = await GameEntry.aggregate([
      {
        $match: {
          ...match,
          ...createdAtFilter,
          gameName: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$gameName",
          totalFreeplay: {
            $sum: {
              $cond: [{ $eq: ["$type", "freeplay"] }, COIN_AMOUNT_EXPR, 0],
            },
          },
          totalDeposit: {
            $sum: {
              $cond: [{ $eq: ["$type", "deposit"] }, COIN_AMOUNT_EXPR, 0],
            },
          },
          totalRedeem: {
            $sum: {
              $cond: [{ $eq: ["$type", "redeem"] }, COIN_AMOUNT_EXPR, 0],
            },
          },
        },
      },
      {
        $addFields: {
          // per-game net coins: redeem − (freeplay + deposit)
          totalCoins: {
            $subtract: [
              "$totalRedeem",
              { $add: ["$totalFreeplay", "$totalDeposit"] },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          gameName: "$_id",
          totalFreeplay: 1,
          totalDeposit: 1,
          totalRedeem: 1,
          totalCoins: 1,
        },
      },
      { $sort: { gameName: 1 } },
    ]);

    res.json(agg);
  } catch (err) {
    console.error("❌ GET /api/game-entries/summary-by-game error:", err);
    res.status(500).json({ message: "Failed to load per-game entry summary" });
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
 * (also keeps Game.totalCoins correct)
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await GameEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Game entry not found" });
    }

    const payload = req.body;

    // snapshot old values for coin delta
    const oldType = entry.type;
    const oldAmtFinal = entry.amountFinal;
    const oldGameName = entry.gameName;

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

    // ⭐ adjust Game.totalCoins for update
    // 1) remove old effect
    const oldDelta = coinEffect(oldType, oldAmtFinal);
    if (oldDelta !== 0) {
      await applyGameDelta(oldGameName, -oldDelta);
    }
    // 2) apply new effect
    const newDelta = coinEffect(entry.type, entry.amountFinal);
    if (newDelta !== 0) {
      await applyGameDelta(entry.gameName, newDelta);
    }

    res.json(entry);
  } catch (err) {
    console.error("❌ PUT /api/game-entries/:id error:", err);
    res.status(500).json({ message: "Failed to update game entry" });
  }
});

/**
 * 🔹 DELETE /api/game-entries/:id
 * (also reverses its effect from Game.totalCoins)
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await GameEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Game entry not found" });
    }

    // ⭐ reverse its effect from totalCoins before delete
    const delta = coinEffect(entry.type, entry.amountFinal);
    if (delta !== 0) {
      await applyGameDelta(entry.gameName, -delta);
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
