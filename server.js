// server.js
import express from "express";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --------------------------
// 🗂️ Setup LowDB (database)
// --------------------------
const adapter = new JSONFile("db.json");
const db = new Low(adapter, {
  games: [],
  payments: [],
  totals: { cashapp: 0, paypal: 0, chime: 0 },
});

// Ensure file initialized
await db.read();
db.data ||= {
  games: [],
  payments: [],
  totals: { cashapp: 0, paypal: 0, chime: 0 },
};
await db.write();

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

/** Recalculate totals from payments for accuracy (in case db.json manually edited) */
async function recalcTotals() {
  await db.read();
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
app.get("/games", async (_, res) => {
  await db.read();
  res.json(db.data.games);
});

app.post("/games", async (req, res) => {
  const {
    name,
    coinsSpent = 0,
    coinsEarned = 0,
    coinsRecharged = 0,
  } = req.body;

  await db.read();
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

app.put("/games/:id", async (req, res) => {
  const { id } = req.params;
  const { coinsSpent, coinsEarned, coinsRecharged } = req.body;
  await db.read();
  const game = db.data.games.find((g) => g.id === parseInt(id));
  if (!game) return res.status(404).json({ message: "Game not found" });

  game.coinsSpent = coinsSpent;
  game.coinsEarned = coinsEarned;
  game.coinsRecharged = coinsRecharged;

  await db.write();
  res.json(game);
});

app.delete("/games/:id", async (req, res) => {
  const { id } = req.params;
  await db.read();
  const index = db.data.games.findIndex((g) => g.id === parseInt(id));
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
  await db.read();
  res.json(db.data.payments);
});

// Fetch current totals
app.get("/totals", async (_, res) => {
  await db.read();
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

  await db.read();

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
  await db.read();
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
// 🚀 Start Server
// --------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
