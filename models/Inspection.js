// models/Inspection.js
import mongoose from "mongoose";

const inspectionSchema = new mongoose.Schema({
  // Auto-generated ID
  inspectionId: { type: String, unique: true }, // e.g. INS01-2025

  // Excel-based fields
  EquipNumber: { type: String, required: true, unique: true },
  AreaName: { type: String, required: true },
  EquipmentName: { type: String, required: true },
  FasteningMethod: { type: String },
  Control: { type: String },
  LocationName: { type: String },
  RiskName: { type: String },
  SerialNo: { type: String },
  SecFastMethod: { type: String },
  DateInspected: { type: Date },
  CheckListNo: { type: String },
  InspectorName: { type: String, required: true },
  CARepairedStatus: { type: String },
  Status: { 
    type: String, 
    enum: ["PASS", "FAIL", "PENDING", "OTHER"], 
    default: "PENDING" 
  },
  EnvironFactor: { type: String },
  Consequence: { type: String },
  Observation: { type: String },
  Comments: { type: String },
  UpdatedDate: { type: Date, default: Date.now },
  InspectorSignature: { type: String }, // Base64 signature image
  PunchDetails: { type: String },
  PrimaryComments: { type: String },
  SecondaryComments: { type: String },
  SafetySecComments: { type: String },
  LoadPathComments: { type: String },

  // Checklists (arrays of checklist IDs)
  PrimaryChecklist: [{ type: Number }],
  SecondaryChecklist: [{ type: Number }],
  SafetyChecklist: [{ type: Number }],
  LoadPathChecklist: [{ type: Number }],
}, { timestamps: true });

// ✅ Auto-generate custom inspectionId before saving
inspectionSchema.pre("save", async function (next) {
  if (this.inspectionId) return next();

  try {
    const currentYear = new Date().getFullYear();

    // Count existing inspections for this year
    const count = await mongoose.model("Inspection").countDocuments({
      createdAt: {
        $gte: new Date(`${currentYear}-01-01`),
        $lt: new Date(`${currentYear + 1}-01-01`),
      },
    });

    const nextNumber = String(count + 1).padStart(2, "0");
    this.inspectionId = `OCS${nextNumber}-${currentYear}`;
    next();
  } catch (err) {
    next(err);
  }
});

const Inspection = mongoose.model("Inspection", inspectionSchema);

export default Inspection;
