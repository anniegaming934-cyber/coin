// src/models/GameLogin.ts
import { Schema, model, Document } from "mongoose";
const gameLoginSchema = new Schema<IGameLogin>(
  {
    ownerType: {
      type: String,
      enum: ["admin", "user"],
      required: true,
    },
    gameName: {
      type: String,
      required: true,
      trim: true,
    },
    loginUsername: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    gameLink: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const GameLogin = model<IGameLogin>("GameLogin", gameLoginSchema);
