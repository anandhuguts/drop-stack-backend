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

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
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

// Seed inspections (reset and add)
app.post("/api/seed-inspections", verifyAdmin, async (req, res) => {
  try {
    const inspections = Array.isArray(req.body)
      ? req.body
      : req.body.inspections || [];

    await Inspection.deleteMany({});
    const createdInspections = await Inspection.insertMany(inspections);

    res.json({
      message: "Inspections seeded successfully",
      inspections: createdInspections,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all inspections
app.delete("/inspections", verifyAdmin, async (req, res) => {
  try {
    const result = await Inspection.deleteMany({});
    res.json({
      message: "All inspections deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Additional modules
app.use("/api", verifyAdmin, rigRoutes);
app.use("/api", verifyAdmin, inspectorRoutes);
app.use("/api", verifyAdmin, pdfRoutes);

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
