// api/config/db.js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "coin";

console.log("🔍 Using MONGODB_URI:", MONGODB_URI);
console.log("🔍 Using DB_NAME:", DB_NAME);

if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI in environment variables");
}

let mongoPromise = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    // already connected
    return;
  }

  if (!mongoPromise) {
    console.log("🔌 Connecting to MongoDB...");
    mongoPromise = mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
    });
  }

  await mongoPromise;
  console.log("✅ MongoDB connected");
}
