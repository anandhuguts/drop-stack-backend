import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/Auth.js";
import { verifyAdmin } from "./middleware/authMiddleware.js";
import Inspection from "./models/Inspection.js";
import rigRoutes from "./routes/rigs.js";
import inspectorRoutes from "./routes/InspectorRoute.js";
import pdfRoutes from "./routes/PdfGenerator.js";
import pdfReportRoutes from "./routes/PdfReport.js";

dotenv.config();

const app = express();

// Increase body size limit for JSON and urlencoded
app.use(express.json({ limit: "50mb" }));      // for JSON payloads
app.use(express.urlencoded({ limit: "50mb", extended: true })); // for form data

app.use(cors());
console.log("Loaded env vars:", process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD ? "Password loaded" : "Password missing");


// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log(err));

// Test route
app.get("/", (req, res) => {
  res.send("Hello! Backend is running.");
});



// Login route (public)
app.use("/api/auth", authRoutes);

// ---------- PROTECTED ROUTES BELOW ----------

// Create inspection
app.post("/inspections", verifyAdmin, async (req, res) => {
  try {
    const {
      EquipNumber,
      EquipmentName,
      AreaName,
      LocationName,
      SerialNo,
      CheckListNo,
      InspectorName,
      DateInspected,
      FasteningMethod,
      SecFastMethod,
      Control,
      CARepairedStatus,
      Status,
      RiskName,
      EnvironFactor,
      Consequence,
      Observation,
      Comments,
      PrimaryComments,
      SecondaryComments,
      SafetySecComments,
      LoadPathComments,
      PunchDetails,
      PrimaryChecklist,
      SecondaryChecklist,
      SafetyChecklist,
      LoadPathChecklist,
    } = req.body;

    // Basic validation
    if (!EquipNumber || !EquipmentName || !AreaName || !InspectorName) {
      return res.status(400).json({ error: "Required fields missing." });
    }

    const newInspection = new Inspection({
      EquipNumber,
      EquipmentName,
      AreaName,
      LocationName,
      SerialNo,
      CheckListNo,
      InspectorName,
      DateInspected,
      FasteningMethod,
      SecFastMethod,
      Control,
      CARepairedStatus,
      Status,
      RiskName,
      EnvironFactor,
      Consequence,
      Observation,
      Comments,
      PrimaryComments,
      SecondaryComments,
      SafetySecComments,
      LoadPathComments,
      PunchDetails,
      PrimaryChecklist,
      SecondaryChecklist,
      SafetyChecklist,
      LoadPathChecklist,
    });

    const savedInspection = await newInspection.save();
    res.status(201).json(savedInspection);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/allinspections", verifyAdmin, async (req, res) => {
  try {
    const inspections = await Inspection.find().sort({ createdAt: -1 });
    res.json(inspections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all inspections
// Get all inspections (Paginated + Sorted by latest first)
app.get("/inspections", verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Sort by createdAt to show most recently added inspections first
    const inspections = await Inspection.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await Inspection.countDocuments();

    res.json({
      inspections,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (err) {
    console.error("Error fetching inspections:", err);
    res.status(500).json({ error: err.message });
  }
});


// Add this after your inspection routes
app.get("/api/inspections/stats", verifyAdmin, async (req, res) => {
  try {
    const total = await Inspection.countDocuments();

    const passCount = await Inspection.countDocuments({
      Status: { $regex: /^pass$/i },
    });

    const failCount = await Inspection.countDocuments({
      Status: { $regex: /^fail$/i },
    });

    const pendingCount = await Inspection.countDocuments({
      Status: { $regex: /^pending$/i },
    });

    // Area-wise stats
    const areaStats = await Inspection.aggregate([
      {
        $group: {
          _id: "$AreaName",
          count: { $sum: 1 },
          pass: {
            $sum: {
              $cond: [
                { $regexMatch: { input: "$Status", regex: /^pass$/i } },
                1,
                0,
              ],
            },
          },
          fail: {
            $sum: {
              $cond: [
                { $regexMatch: { input: "$Status", regex: /^fail$/i } },
                1,
                0,
              ],
            },
          },
          pending: {
            $sum: {
              $cond: [
                { $regexMatch: { input: "$Status", regex: /^pending$/i } },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
          pass: 1,
          fail: 1,
          pending: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(2) : 0;

    res.json({
      total,
      passCount,
      failCount,
      pendingCount,
      passRate,
      areaStats, // ✅ new field
    });
  } catch (err) {
    console.error("Error fetching inspection stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// Delete all old inspections before importing new ones
app.post("/inspections/import", verifyAdmin, async (req, res) => {
  console.log("Import request body:", req.body);

  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "No inspections to import" });
    }

    // Step 1️⃣: Delete all existing inspections
    await Inspection.deleteMany({});
    console.log("🧹 All old inspections deleted");

    // Step 2️⃣: Prepare new data
    const inspectionsData = req.body.map((item) => ({
      ...item,
      scheduleDate: new Date(item.scheduleDate),
    }));

    // Step 3️⃣: Save each new inspection
    const createdInspections = [];
    for (const data of inspectionsData) {
      const inspection = new Inspection(data);
      await inspection.save(); // triggers pre('save') middleware
      createdInspections.push(inspection);
    }

    console.log(`✅ Imported ${createdInspections.length} inspections`);
    res.status(200).json({
      message: "Successfully replaced all inspections",
      importedCount: createdInspections.length,
    });
  } catch (error) {
    console.error("❌ Import error:", error);
    res
      .status(500)
      .json({ message: "Failed to import inspections", error: error.message });
  }
});



// Get inspection by ID
app.get("/inspections/:id", verifyAdmin, async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id)
      .populate("inspectors", "name specialties");

    if (!inspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    res.json(inspection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Update inspection
app.put("/inspections/:id", verifyAdmin, async (req, res) => {
  try {
    const updates = req.body;
    if (updates.inspectors && !Array.isArray(updates.inspectors)) {
      return res.status(400).json({ error: "Inspectors must be an array." });
    }

    const updatedInspection = await Inspection.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedInspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    res.json(updatedInspection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Import route



// Seed inspections (reset and add)
app.post("/api/seed-inspections", async (req, res) => {
  try {
    const inspections = Array.isArray(req.body)
      ? req.body
      : req.body.inspections || [];

    await Inspection.deleteMany({});

    const createdInspections = [];

    for (const data of inspections) {
      const inspection = new Inspection(data);
      const saved = await inspection.save(); // ✅ triggers pre('save')
      createdInspections.push(saved);
    }

    res.json({
      message: "Inspections seeded successfully",
      inspections: createdInspections,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Additional modules
app.use("/api", verifyAdmin, rigRoutes);
app.use("/api", verifyAdmin, inspectorRoutes);
app.use("/api", verifyAdmin, pdfRoutes);
app.use("/api", verifyAdmin, pdfReportRoutes);

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
