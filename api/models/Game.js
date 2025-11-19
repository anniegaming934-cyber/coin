// api/models/Game.js
import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
  {
    // numeric ID used by frontend (keep unique for each game)
    id: { type: Number, required: true, unique: true },

    name: { type: String, required: true, trim: true },

    // base coins you recharge for this game
    coinsRecharged: { type: Number, default: 0 },

    // optional recharge timestamp (YYYY-MM-DD)
    lastRechargeDate: { type: String, default: null },
  },
  { timestamps: true }
);

// ❌ no pre("save") — totalCoins is calculated in routes using GameEntry

const Game = mongoose.models.Game || mongoose.model("Game", GameSchema);
export default Game;
