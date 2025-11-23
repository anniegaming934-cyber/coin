import mongoose from "mongoose";

const { Schema, model } = mongoose;

const gameLoginSchema = new Schema(
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

const GameLogin = model("GameLogin", gameLoginSchema);

export default GameLogin;
