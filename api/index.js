// api/index.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
const DB_NAME = process.env.MONGODB_DB || "coin";

if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI environment variable");
}

/**
 * Vercel/serverless-friendly connection helper.
 */
let mongoPromise = null;
async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
    });
  }
  await mongoPromise;
}

// --------------------------
// 🔐 Auth config (JWT)
// --------------------------
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role || "user",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// --------------------------
// 🧬 Mongoose Schemas/Models
// --------------------------

const GameSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true }, // numeric id used by frontend
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
    id: { type: String, required: true, unique: true }, // nanoid
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cashapp", "paypal", "chime"],
      required: true,
    },
    txType: {
      type: String,
      enum: ["cashin", "cashout"],
      default: "cashin", // old docs treated as cashin
    },
    note: { type: String, default: null },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

// Login history for audit
const LoginHistorySchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    loginTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// User activity for game moves (for charts)
const UserActivitySchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    gameId: { type: Number, required: true },
    gameName: { type: String, required: true },

    freeplay: { type: Number, default: 0 }, // coinsEarned +
    redeem: { type: Number, default: 0 }, // coinsSpent +
    deposit: { type: Number, default: 0 }, // coinsRecharged +

    date: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    time: {
      type: String,
      default: () => new Date().toLocaleTimeString("en-US"),
    },
  },
  { timestamps: true }
);

// Avoid recompiling models
const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
const Payment =
  mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const LoginHistory =
  mongoose.models.LoginHistory ||
  mongoose.model("LoginHistory", LoginHistorySchema);
const UserActivity =
  mongoose.models.UserActivity ||
  mongoose.model("UserActivity", UserActivitySchema);

// --------------------------
// ⚙️ Helper Functions
// --------------------------
const validMethods = ["cashapp", "paypal", "chime"];

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function computeTotals() {
  await connectDB();

  const totals = { cashapp: 0, paypal: 0, chime: 0 };

  // also get txType to know cashin/cashout
  const payments = await Payment.find(
    {},
    { amount: 1, method: 1, txType: 1 }
  ).lean();

  for (const p of payments) {
    if (!validMethods.includes(p.method)) continue;

    const type = p.txType === "cashout" ? "cashout" : "cashin";
    if (type === "cashin") {
      totals[p.method] += p.amount;
    } else {
      totals[p.method] -= p.amount;
    }
  }

  return totals;
}

// Seed admin user (email: admin@example.com, password: NepKath@2025?)
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "NepKath@2025?";
const ADMIN_NAME = "admin";

let adminSeeded = false;
async function ensureAdminUser() {
  if (adminSeeded) return;
  adminSeeded = true;

  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL }).lean();
  if (existingAdmin) {
    console.log("ℹ️ Admin user already exists");
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash,
    role: "admin",
  });

  console.log(
    `✅ Default admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (role: admin)`
  );
}

// --------------------------
// 🔐 AUTH ROUTES
// --------------------------

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  try {
    await connectDB();
    await ensureAdminUser();

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name || "",
      email,
      passwordHash,
      role: "user",
    });

    const token = createToken(user);

    res.status(201).json({
      ok: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    res.status(500).json({ message: "Failed to register" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== "string" || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    await connectDB();
    await ensureAdminUser();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user);

    // Record login history
    await LoginHistory.create({
      userEmail: user.email,
      userName: user.name || "Unknown User",
      loginTime: new Date(),
    });

    res.json({
      ok: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({ message: "Failed to login" });
  }
});

// GET /api/auth/me – requires Bearer token
app.get("/api/auth/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const [, token] = auth.split(" ");

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    await connectDB();
    await ensureAdminUser();

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      ok: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
    });
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

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

    const newGame = await Game.create({
      id: Date.now(), // numeric id used by frontend
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

// PUT /api/games/:id  (absolute totals update)
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

// POST /api/games/:id/add-moves  (increment-only for user actions)
app.post("/api/games/:id/add-moves", async (req, res) => {
  const { id } = req.params;
  const {
    freeplayDelta = 0, // coinsEarned +
    redeemDelta = 0, // coinsSpent +
    depositDelta = 0, // coinsRecharged +
    username = "Unknown User",
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

    // Update game totals
    game.coinsEarned = safeNum(game.coinsEarned) + freeplay;
    game.coinsSpent = safeNum(game.coinsSpent) + redeem;
    game.coinsRecharged = safeNum(game.coinsRecharged) + deposit;

    await game.save();

    // Log user activity for charts
    if (freeplay || redeem || deposit) {
      await UserActivity.create({
        username,
        gameId: game.id,
        gameName: game.name,
        freeplay,
        redeem,
        deposit,
      });
    }

    return res.json(game);
  } catch (err) {
    console.error("POST /api/games/:id/add-moves error:", err);
    return res.status(500).json({ message: "Failed to update game moves" });
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
  const { amount, method, note, date, txType } = req.body;
  const amt = Number(amount);

  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Invalid method" });
  }

  // cashin / cashout, default cashin
  const type = txType === "cashout" ? "cashout" : "cashin";

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
      txType: type,
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
  const { amount, method, note, date, txType } = req.body;

  try {
    await connectDB();

    const payment = await Payment.findOne({ id });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // ---- amount ----
    let newAmount = payment.amount;
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      newAmount = Math.round(amt * 100) / 100;
    }

    // ---- method ----
    let newMethod = payment.method;
    if (method !== undefined) {
      if (!validMethods.includes(method)) {
        return res.status(400).json({ message: "Invalid method" });
      }
      newMethod = method;
    }

    // ---- txType (cashin / cashout) ----
    let newTxType = payment.txType || "cashin";
    if (txType !== undefined) {
      newTxType = txType === "cashout" ? "cashout" : "cashin";
    }

    // ---- date ----
    let newDate = payment.date;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      newDate = date;
    }

    // ---- note ----
    const newNote = note !== undefined ? note || null : payment.note;

    // apply updates
    payment.amount = newAmount;
    payment.method = newMethod;
    payment.txType = newTxType;
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
// 📜 LOGIN HISTORY ROUTE
// --------------------------

// GET /api/logins?username=aaa
app.get("/api/logins", async (req, res) => {
  const { username } = req.query;

  try {
    await connectDB();

    const filter = username ? { userName: String(username) } : {};
    const history = await LoginHistory.find(filter)
      .sort({ loginTime: -1 })
      .limit(50)
      .lean();

    res.json(history);
  } catch (err) {
    console.error("GET /api/logins error:", err);
    res.status(500).json({ message: "Failed to load login history" });
  }
});

// --------------------------
// 📊 STATS ROUTE FOR CHARTS
// --------------------------
const RANGE_DAYS = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

// GET /api/stats/game-coins?range=day|week|month|year
app.get("/api/stats/game-coins", async (req, res) => {
  const range = String(req.query.range || "week").toLowerCase();
  const days = RANGE_DAYS[range] || RANGE_DAYS.week;

  try {
    await connectDB();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - (days - 1));

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            gameId: "$gameId",
            gameName: "$gameName",
          },
          freeplay: { $sum: "$freeplay" },
          redeem: { $sum: "$redeem" },
          deposit: { $sum: "$deposit" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          gameId: "$_id.gameId",
          gameName: "$_id.gameName",
          coinsEarned: "$freeplay",
          coinsSpent: "$redeem",
          coinsRecharged: "$deposit",
        },
      },
      { $sort: { date: 1, gameName: 1 } },
    ];

    const stats = await UserActivity.aggregate(pipeline);

    return res.json({ stats });
  } catch (err) {
    console.error("GET /api/stats/game-coins error:", err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
});

// --------------------------
// 🩺 Health check route
// --------------------------
app.get("/api/health", async (_, res) => {
  try {
    await connectDB();
    res.json({ ok: true, db: "connected" });
  } catch (e) {
    res.status(500).json({ ok: false, error: "DB connection failed" });
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

export default app;
