// api/models/LoginHistory.js
import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: { type: String },
    loggedInAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const LoginHistory =
  mongoose.models.LoginHistory ||
  mongoose.model("LoginHistory", loginHistorySchema);

export default LoginHistory;
