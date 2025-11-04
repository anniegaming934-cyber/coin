// api/index.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { nanoid } from "nanoid";

// --------------------------
// 🚀 Express App
// --------------------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------------------
// 🔌 MongoDB Connection
// --------------------------
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI environment variable");
}

/**
 * Vercel/serverless-friendly connection helper.
 * Reuses existing connection between invocations.
 */
let mongoPromise = null;
async function connectDB() {
  if (mongoose.connection.readyState === 1) return; // already connected
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB || "game-dashboard",
    });
  }
  await mongoPromise;
}

// --------------------------
// 🧬 Mongoose Schemas/Models
// --------------------------

const GameSchema = new mongoose.Schema(
  {
    // keep a numeric "id" so frontend code works unchanged
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    coinsSpent: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    coinsRecharged: { type: Number, default: 0 },
    lastRechargeDate: { type: String, default: null }, // "YYYY-MM-DD" or null
  },
  { timestamps: true }
);

const PaymentSchema = new mongoose.Schema(
  {
    // same id style you had before (nanoid string)
    id: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cashapp", "paypal", "chime"],
      required: true,
    },
    note: { type: String, default: null },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Avoid recompiling models in dev/serverless
const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
const Payment =
  mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

async function computeTotals() {
  await connectDB();

  const totals = { cashapp: 0, paypal: 0, chime: 0 };

  const payments = await Payment.find({}, { amount: 1, method: 1 }).lean();

  for (const p of payments) {
    if (validMethods.includes(p.method)) {
      totals[p.method] += p.amount;
    }
  }

  return totals;
}

// --------------------------
// 🎮 GAME ROUTES
// --------------------------

// GET /api/games
app.get("/api/games", async (_, res) => {
  try {
    await connectDB();
    const games = await Game.find({}).sort({ createdAt: 1 }).lean();
    res.json(games);
  } catch (err) {
    console.error("GET /api/games error:", err);
    res.status(500).json({ message: "Failed to load games" });
  }
});

// POST /api/games
app.post("/api/games", async (req, res) => {
  const {
    name,
    coinsSpent = 0,
    coinsEarned = 0,
    coinsRecharged = 0,
  } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Game name is required" });
  }

  try {
    await connectDB();

    // use Date.now() like before so your frontend "id" still works
    const newGame = await Game.create({
      id: Date.now(),
      name,
      coinsSpent,
      coinsEarned,
      coinsRecharged,
    });

    res.status(201).json(newGame);
  } catch (err) {
    console.error("POST /api/games error:", err);
    res.status(500).json({ message: "Failed to create game" });
  }
});

// PUT /api/games/:id
app.put("/api/games/:id", async (req, res) => {
  const { id } = req.params;
  const { coinsSpent, coinsEarned, coinsRecharged, lastRechargeDate } =
    req.body;

  try {
    await connectDB();

    const game = await Game.findOne({ id: Number(id) });
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (typeof coinsSpent === "number") game.coinsSpent = coinsSpent;
    if (typeof coinsEarned === "number") game.coinsEarned = coinsEarned;
    if (typeof coinsRecharged === "number")
      game.coinsRecharged = coinsRecharged;
    if (lastRechargeDate !== undefined)
      game.lastRechargeDate = lastRechargeDate;

    await game.save();

    res.json(game);
  } catch (err) {
    console.error("PUT /api/games/:id error:", err);
    res.status(500).json({ message: "Failed to update game" });
  }
});

// DELETE /api/games/:id
app.delete("/api/games/:id", async (req, res) => {
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

// --------------------------
// 💵 PAYMENT ROUTES
// --------------------------

// GET /api/payments?date=YYYY-MM-DD (optional filter)
app.get("/api/payments", async (req, res) => {
  const { date } = req.query;

  try {
    await connectDB();

    const query = date ? { date: String(date) } : {};
    const payments = await Payment.find(query).sort({ createdAt: -1 }).lean();

    res.json(payments);
  } catch (err) {
    console.error("GET /api/payments error:", err);
    res.status(500).json({ message: "Failed to load payments" });
  }
});

// GET /api/totals
app.get("/api/totals", async (_, res) => {
  try {
    const totals = await computeTotals();
    res.json(totals);
  } catch (err) {
    console.error("GET /api/totals error:", err);
    res.status(500).json({ message: "Failed to compute totals" });
  }
});

// POST /api/payments
app.post("/api/payments", async (req, res) => {
  const { amount, method, note, date } = req.body;
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Invalid method" });
  }

  // normalize date: expect "YYYY-MM-DD"; fallback to today's date
  let paymentDate;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    paymentDate = date;
  } else {
    paymentDate = new Date().toISOString().slice(0, 10);
  }

  try {
    await connectDB();

    const payment = await Payment.create({
      id: nanoid(),
      amount: Math.round(amt * 100) / 100,
      method,
      note: note || null,
      date: paymentDate,
      createdAt: new Date(),
    });

    const totals = await computeTotals();

    res.status(201).json({
      ok: true,
      payment,
      totals,
    });
  } catch (err) {
    console.error("POST /api/payments error:", err);
    res.status(500).json({ message: "Failed to create payment" });
  }
});

// POST /api/reset
app.post("/api/reset", async (_, res) => {
  try {
    await connectDB();
    await Payment.deleteMany({});
    const totals = { cashapp: 0, paypal: 0, chime: 0 };

    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /api/reset error:", err);
    res.status(500).json({ message: "Failed to reset payments" });
  }
});

// POST /api/recalc
app.post("/api/recalc", async (_, res) => {
  try {
    const totals = await computeTotals();
    res.json({ ok: true, totals });
  } catch (err) {
    console.error("POST /api/recalc error:", err);
    res.status(500).json({ message: "Failed to recalc totals" });
  }
});

// PUT /api/payments/:id  (edit a payment)
app.put("/api/payments/:id", async (req, res) => {
  const { id } = req.params;
  const { amount, method, note, date } = req.body;

  try {
    await connectDB();

    const payment = await Payment.findOne({ id });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const oldAmount = payment.amount;
    const oldMethod = payment.method;

    // validate new values or keep old
    let newAmount = oldAmount;
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      newAmount = Math.round(amt * 100) / 100;
    }

    let newMethod = oldMethod;
    if (method !== undefined) {
      if (!validMethods.includes(method)) {
        return res.status(400).json({ message: "Invalid method" });
      }
      newMethod = method;
    }

    let newDate = payment.date;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      newDate = date;
    }

    const newNote = note !== undefined ? note || null : payment.note;

    payment.amount = newAmount;
    payment.method = newMethod;
    payment.note = newNote;
    payment.date = newDate;

    await payment.save();

    const totals = await computeTotals();

    res.json({
      ok: true,
      payment,
      totals,
    });
  } catch (err) {
    console.error("PUT /api/payments/:id error:", err);
    res.status(500).json({ message: "Failed to update payment" });
  }
});

// DELETE /api/payments/:id  (delete a payment)
app.delete("/api/payments/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await connectDB();

    const removed = await Payment.findOneAndDelete({ id }).lean();
    if (!removed) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const totals = await computeTotals();

    res.json({
      ok: true,
      removed,
      totals,
    });
  } catch (err) {
    console.error("DELETE /api/payments/:id error:", err);
    res.status(500).json({ message: "Failed to delete payment" });
  }
});

// --------------------------
// 🚀 Local dev vs Vercel
// --------------------------
const isVercel = process.env.VERCEL === "1";

if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

// Vercel serverless handler
export default app;

