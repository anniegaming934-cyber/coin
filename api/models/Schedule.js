import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, required: true }, // Monday–Sunday
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true }, // "10:30"
    title: { type: String, required: true }, // "Study", "Work", etc.
    username: { type: String, required: false }, // optional: per-user schedule
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", ScheduleSchema);
