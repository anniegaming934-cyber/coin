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
  await db.read();
  if (!db.data) {
    db.data = { ...defaultData };
  }
  db.data.games ||= [];
  db.data.payments ||= [];
  db.data.totals ||= { cashapp: 0, paypal: 0, chime: 0 };
  await db.write();
}

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

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
app.get("/api/games", async (_, res) => {
  await ensureDb();
  res.json(db.data.games);
});

// POST /api/games
app.post("/api/games", async (req, res) => {
  const {
    name,
    coinsSpent = 0,
    coinsEarned = 0,
    coinsRecharged = 0,
    lastRechargeDate = null, // 👈 optional, for consistency with frontend type
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
    lastRechargeDate,
  };

  db.data.games.push(newGame);
  await db.write();

  res.status(201).json(newGame);
});

// PUT /api/games/:id
app.put("/api/games/:id", async (req, res) => {
  const { id } = req.params;
  const { coinsSpent, coinsEarned, coinsRecharged, lastRechargeDate } =
    req.body;

  await ensureDb();

  const game = db.data.games.find((g) => g.id === parseInt(id, 10));
  if (!game) return res.status(404).json({ message: "Game not found" });

  // These three come from App.handleUpdate
  if (typeof coinsSpent === "number") game.coinsSpent = coinsSpent;
  if (typeof coinsEarned === "number") game.coinsEarned = coinsEarned;
  if (typeof coinsRecharged === "number") game.coinsRecharged = coinsRecharged;

  // Optional — only update if provided
  if (lastRechargeDate !== undefined) {
    game.lastRechargeDate = lastRechargeDate;
  }

  await db.write();
  res.json(game);
});

// DELETE /api/games/:id
app.delete("/api/games/:id", async (req, res) => {
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

// GET /api/payments?date=YYYY-MM-DD (optional filter)
app.get("/api/payments", async (req, res) => {
  await ensureDb();
  const { date } = req.query;

  let payments = db.data.payments;

  // if a date is provided, only return payments for that date
  if (date) {
    payments = payments.filter((p) => p.date === date);
  }

  res.json(payments);
});

// GET /api/totals
app.get("/api/totals", async (_, res) => {
  await ensureDb();
  res.json(db.data.totals);
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

  await ensureDb();

  // normalize date: expect "YYYY-MM-DD"; fallback to today's date
  let paymentDate;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    paymentDate = date;
  } else {
    paymentDate = new Date().toISOString().slice(0, 10);
  }

  const payment = {
    id: nanoid(),
    amount: Math.round(amt * 100) / 100,
    method,
    note: note || null,
    date: paymentDate, // stored by date
    createdAt: new Date().toISOString(),
  };

  db.data.payments.push(payment);
  db.data.totals[method] += payment.amount;

  await db.write();

  res.status(201).json({
    ok: true,
    payment,
    totals: db.data.totals,
  });
});

// POST /api/reset
app.post("/api/reset", async (_, res) => {
  await ensureDb();
  db.data.payments = [];
  db.data.totals = { cashapp: 0, paypal: 0, chime: 0 };
  await db.write();
  res.json({ ok: true, totals: db.data.totals });
});

// POST /api/recalc
app.post("/api/recalc", async (_, res) => {
  const totals = await recalcTotals();
  res.json({ ok: true, totals });
});

// PUT /api/payments/:id  (edit a payment)
app.put("/api/payments/:id", async (req, res) => {
  const { id } = req.params;
  const { amount, method, note, date } = req.body;

  await ensureDb();

  const payment = db.data.payments.find((p) => p.id === id);
  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  const oldAmount = payment.amount;
  const oldMethod = payment.method;

  // ---- validate new values (or keep old) ----
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

  // ---- update totals: remove old, add new ----
  if (validMethods.includes(oldMethod)) {
    db.data.totals[oldMethod] -= oldAmount;
  }
  if (validMethods.includes(newMethod)) {
    db.data.totals[newMethod] += newAmount;
  }

  // ---- update payment ----
  payment.amount = newAmount;
  payment.method = newMethod;
  payment.note = newNote;
  payment.date = newDate;

  await db.write();

  res.json({
    ok: true,
    payment,
    totals: db.data.totals,
  });
});

// DELETE /api/payments/:id  (delete a payment)
app.delete("/api/payments/:id", async (req, res) => {
  const { id } = req.params;
  await ensureDb();

  const index = db.data.payments.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Payment not found" });
  }

  const [removed] = db.data.payments.splice(index, 1);

  // adjust totals
  if (validMethods.includes(removed.method)) {
    db.data.totals[removed.method] -= removed.amount;
  }

  await db.write();

  res.json({
    ok: true,
    removed,
    totals: db.data.totals,
  });
});

// --------------------------
// 🚀 Local dev vs Vercel
// --------------------------
if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

// Vercel serverless handler
export default app;
