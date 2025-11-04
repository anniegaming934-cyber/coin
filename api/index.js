// api/index.js
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
// Locally we can use ./db.json in the project.
const isVercel = process.env.VERCEL === "1";
const DB_FILE = isVercel ? "/tmp/db.json" : "db.json";

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

// GET /api/games
app.get("/games", async (_, res) => {
  await ensureDb();
  res.json(db.data.games);
});

// POST /api/games
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

// PUT /api/games/:id
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

// DELETE /api/games/:id
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

// GET /api/payments
app.get("/payments", async (_, res) => {
  await ensureDb();
  res.json(db.data.payments);
});

// GET /api/totals
app.get("/totals", async (_, res) => {
  await ensureDb();
  res.json(db.data.totals);
});

// POST /api/payments
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

  // Save new payment
  const payment = {
    id: nanoid(),
    amount: Math.round(amt * 100) / 100,
    method,
    note: note || null,
    createdAt: new Date().toISOString(),
  };
  db.data.payments.push(payment);

  // Update totals safely
  db.data.totals[method] += payment.amount;

  await db.write();

  console.log(`💰 Added ${payment.amount} via ${method}`);

  res.status(201).json({
    ok: true,
    payment,
    totals: db.data.totals,
  });
});

// POST /api/reset
app.post("/reset", async (_, res) => {
  await ensureDb();
  db.data.payments = [];
  db.data.totals = { cashapp: 0, paypal: 0, chime: 0 };
  await db.write();
  console.log("🔄 All payments and totals reset");
  res.json({ ok: true, totals: db.data.totals });
});

// POST /api/recalc
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

// Vercel: export Express app as default handler
export default app;
