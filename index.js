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
    const { title, priority, description, scheduleDate, estimatedDuration, rig, inspectors } = req.body;

    if (!Array.isArray(inspectors) || inspectors.length === 0) {
      return res.status(400).json({ error: "At least one inspector must be assigned." });
    }

    const newInspection = new Inspection({
      title,
      priority,
      description,
      scheduleDate,
      estimatedDuration,
      rig,
      inspectors,
    });

    const savedInspection = await newInspection.save();
    res.status(201).json(savedInspection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all inspections
app.get("/inspections", verifyAdmin, async (req, res) => {
  try {
    const inspections = await Inspection.find().sort({ scheduleDate: -1 });
    res.json(inspections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/inspections/import", async (req, res) => {
  console.log("Import request body:", req.body);

  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "No inspections to import" });
    }

    // ✅ Convert scheduleDate to Date object but don't assign inspectionId
    const inspectionsData = req.body.map((item) => ({
      ...item,
      scheduleDate: new Date(item.scheduleDate),
    }));

    // ✅ Use create() instead of insertMany()
    // Because `insertMany()` skips Mongoose middleware by default!
    const createdInspections = [];
    for (const data of inspectionsData) {
      const inspection = new Inspection(data);
      await inspection.save(); // This triggers the pre("save") hook
      createdInspections.push(inspection);
    }

    res.status(200).json(createdInspections);
  } catch (error) {
    console.error("Import error:", error);
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
