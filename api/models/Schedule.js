import mongoose from "mongoose";

const { Schema, model } = mongoose;

const scheduleSchema = new Schema(
  {
    // multiple usernames per schedule entry
    usernames: {
      type: [String],
      required: true,
    },
    day: {
      type: String,
      required: true,
      trim: true,
    },
    // store as "09:30 AM"
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const Schedule = model("Schedule", scheduleSchema);

export default Schedule;
