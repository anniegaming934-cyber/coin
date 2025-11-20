import mongoose from "mongoose";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const ScheduleSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true, // schedule is always tied to a user
      trim: true,
    },
    day: {
      type: String,
      enum: DAYS,
      required: true,
    },
    startTime: {
      type: String, // "09:00"
      required: true,
    },
    endTime: {
      type: String, // "10:30"
      required: true,
    },
    title: {
      type: String, // "Work", "Study", ...
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", ScheduleSchema);
