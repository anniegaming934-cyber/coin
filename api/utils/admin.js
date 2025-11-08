// api/utils/admin.js
import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function ensureAdminUser() {
  const ADMIN_EMAIL = (
    process.env.ADMIN_EMAIL || "admin@example.com"
  ).toLowerCase();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NepKath@2025?";

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log("✅ Admin user already exists:", ADMIN_EMAIL);
    return existing;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await User.create({
    name: "Admin",
    email: ADMIN_EMAIL,
    passwordHash,
    role: "admin",
    isAdmin: true,
  });

  console.log("✅ Admin user created:", ADMIN_EMAIL);
  return admin;
}
