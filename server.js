// server.js
import express from "express";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";

// --------------------------
// 🚀 Express App
// --------------------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------------------
// 🗂️ Setup LowDB (database)
// --------------------------

// On Vercel, filesystem is read-only except /tmp
// So we keep our JSON DB in /tmp for writes.
const DB_FILE = "/tmp/db.json";

const defaultData = {
  games: [],
  payments: [],
  totals: { cashapp: 0, paypal: 0, chime: 0 },
};

const adapter = new JSONFile(DB_FILE);
const db = new Low(adapter, defaultData);

/** Ensure DB is loaded and has default shape */
async function ensureDb() {
  await db.read(); // if file missing, LowDB keeps defaultData
  if (!db.data) {
    db.data = { ...defaultData };
    await db.write();
  } else {
    // make sure all keys exist
    db.data.games ||= [];
    db.data.payments ||= [];
    db.data.totals ||= { cashapp: 0, paypal: 0, chime: 0 };
  }
}

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

/** Recalculate totals from payments for accuracy */
async function recalcTotals() {
  await ensureDb();
  const totals = { cashapp: 0, paypal: 0, chime: 0 };
  for (const p of db.data.payments) {
    if (validMethods.includes(p.method)) {
      totals[p.method] += p.amount;
    }
  }
  db.data.totals = totals;
  await db.write();
  return totals;
}

// --------------------------
// 🎮 GAME ROUTES
// --------------------------

// Get all games
app.get("/games", async (_, res) => {
  await ensureDb();
  res.json(db.data.games);
});

// Add new game
app.post("/games", async (req, res) => {
  const {
    name,
    coinsSpent = 0,
    coinsEarned = 0,
    coinsRecharged = 0,
  } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Game name is required" });
  }

  await ensureDb();

  const newGame = {
    id: Date.now(),
    name,
    coinsSpent,
    coinsEarned,
    coinsRecharged,
  };

  db.data.games.push(newGame);
  await db.write();

  res.status(201).json(newGame);
});

// Update game by id
app.put("/games/:id", async (req, res) => {
  const { id } = req.params;
  const { coinsSpent, coinsEarned, coinsRecharged } = req.body;

  await ensureDb();

  const game = db.data.games.find((g) => g.id === parseInt(id, 10));
  if (!game) return res.status(404).json({ message: "Game not found" });

  game.coinsSpent = coinsSpent;
  game.coinsEarned = coinsEarned;
  game.coinsRecharged = coinsRecharged;

  await db.write();
  res.json(game);
});

// Delete game by id
app.delete("/games/:id", async (req, res) => {
  const { id } = req.params;
  await ensureDb();

  const index = db.data.games.findIndex((g) => g.id === parseInt(id, 10));
  if (index === -1) return res.status(404).json({ message: "Game not found" });

  const removed = db.data.games.splice(index, 1)[0];
  await db.write();
  res.json(removed);
});

// --------------------------
// 💵 PAYMENT ROUTES
// --------------------------

// Fetch all payment history
app.get("/payments", async (_, res) => {
  await ensureDb();
  res.json(db.data.payments);
});

// Fetch current totals
app.get("/totals", async (_, res) => {
  await ensureDb();
  res.json(db.data.totals);
});

// Add new payment
app.post("/payments", async (req, res) => {
  const { amount, method, note } = req.body;
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Invalid method" });
  }

  await ensureDb();

  // 1️⃣ Save new payment
  const payment = {
    id: nanoid(),
    amount: Math.round(amt * 100) / 100,
    method,
    note: note || null,
    createdAt: new Date().toISOString(),
  };
  db.data.payments.push(payment);

  // 2️⃣ Update totals safely
  db.data.totals[method] += payment.amount;

  // 3️⃣ Write back to DB
  await db.write();

  console.log(`💰 Added ${payment.amount} via ${method}`);

  res.status(201).json({
    ok: true,
    payment,
    totals: db.data.totals,
  });
});

// Reset all payment data
app.post("/reset", async (_, res) => {
  await ensureDb();
  db.data.payments = [];
  db.data.totals = { cashapp: 0, paypal: 0, chime: 0 };
  await db.write();
  console.log("🔄 All payments and totals reset");
  res.json({ ok: true, totals: db.data.totals });
});

// Optional endpoint to recalc totals manually
app.post("/recalc", async (_, res) => {
  const totals = await recalcTotals();
  res.json({ ok: true, totals });
});

// --------------------------
// 🚀 Local dev vs Vercel
// --------------------------

// Local development: run on PORT
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

// Vercel: export Express app as default
export default app;
