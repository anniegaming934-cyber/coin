// api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" }); // or just dotenv.config() if you rename to .env

// ✅ import all routers
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import paymentRoutes from "./routes/payments.js";
import loginRoutes from "./routes/logins.js";
import statsRoutes from "./routes/stats.js";
import healthRoutes from "./routes/health.js";
import adminUserRoutes from "./routes/adminUsers.js";

const app = express();

const isVercel = process.env.VERCEL === "1";

// ✅ CORS config (only once)
app.use(
  cors({
    origin: isVercel ? true : "http://localhost:3000", // your React dev port
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ JSON body parsing (only once)
app.use(express.json());

// ✅ global logger (optional but useful)
app.use((req, res, next) => {
  console.log("📥", req.method, req.url);
  next();
});

//  ✅ mount routes
app.use("/api/auth", authRoutes);
app.use("/api", gameRoutes);
app.use("/api", paymentRoutes);
app.use("/api", loginRoutes);
app.use("/api", statsRoutes);
app.use("/api", healthRoutes);
app.use("/api/admin/users", adminUserRoutes);

// ✅ start server locally (Vercel will NOT run this)
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on port ${PORT}`);
});

export default app;
