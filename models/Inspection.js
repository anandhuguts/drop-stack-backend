// models/Inspection.js
import mongoose from "mongoose";

const inspectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  priority: { type: String, enum: ["Low", "Medium", "High", "Urgent"], required: true },
  description: { type: String, required: true },
  scheduleDate: { type: Date, required: true },
  estimatedDuration: { type: Number, required: true }, // in hours
  rig: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "fail"],
      default: "pending",
    },
  inspectors: [{ type: String, required: true }] // array of inspector names
}, { timestamps: true });

const Inspection = mongoose.model("Inspection", inspectionSchema);

export default Inspection;
