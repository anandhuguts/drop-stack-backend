// models/Inspection.js
import mongoose from "mongoose";

const inspectionSchema = new mongoose.Schema({
  inspectionId: { type: String, unique: true }, // custom ID
  title: { type: String, required: true },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High", "Urgent"],
    required: true,
  },
  description: { type: String, required: true },
  scheduleDate: { type: Date, required: true },
  estimatedDuration: { type: Number, required: true }, // in hours
  rig: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "fail"],
    default: "pending",
  },
  inspectors: [{ type: String, required: true }], // array of inspector names

  // ✅ New fields
  completionRate: { type: Number, min: 1, max: 100, default: 0 },
  issues: { type: String, default: "" },
}, { timestamps: true });

// Pre-save middleware to auto-generate inspectionId
inspectionSchema.pre("save", async function (next) {
  if (this.inspectionId) return next();

  try {
    const currentYear = new Date().getFullYear();

    const count = await mongoose.model("Inspection").countDocuments({
      createdAt: {
        $gte: new Date(`${currentYear}-01-01`),
        $lt: new Date(`${currentYear + 1}-01-01`),
      },
    });

    const nextNumber = String(count + 1).padStart(2, "0");

    this.inspectionId = `INS${nextNumber}-${currentYear}`;

    next();
  } catch (err) {
    next(err);
  }
});

const Inspection = mongoose.model("Inspection", inspectionSchema);

export default Inspection;
