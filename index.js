// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Inspection from "./models/Inspection.js";
import rigRoutes from "./routes/rigs.js";
import inspectorRoutes from "./routes/InspectorRoute.js";
import pdfRoutes from "./routes/PdfGenerator.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // to parse JSON request bodies

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));
// Test route
app.get("/", (req, res) => {
  res.send("Hello! Backend is running.");
});

// POST new inspection
app.post("/inspections", async (req, res) => {
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
      inspectors
    });

    const savedInspection = await newInspection.save();
    res.status(201).json(savedInspection);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/inspections", async (req, res) => {
  try {
    const inspections = await Inspection.find().sort({ scheduleDate: -1 });
    res.json(inspections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inspections/:id
app.get("/inspections/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find inspection by ID and populate inspector details
    const inspection = await Inspection.findById(id)
      .populate("inspectors", "name specialties"); // only fetch name and specialties from Inspector collection

    if (!inspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    res.json(inspection);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE inspection by ID
app.put("/inspections/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Ensure inspectors is an array if provided
    if (updates.inspectors && !Array.isArray(updates.inspectors)) {
      return res.status(400).json({ error: "Inspectors must be an array." });
    }

    const updatedInspection = await Inspection.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true } // return updated doc & validate schema
    );

    if (!updatedInspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    res.json(updatedInspection);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/seed-inspections", async (req, res) => {
  try {
    const { inspections = [] } = req.body;

    // 1. Delete all existing inspections
    await Inspection.deleteMany({});

    // 2. Insert new inspections
    const createdInspections = await Inspection.insertMany(inspections);

    res.json({
      message: "Inspections seeded successfully",
      inspections: createdInspections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// DELETE all inspections
app.delete("/inspections", async (req, res) => {
  try {
    const result = await Inspection.deleteMany({});
    res.json({ message: "All inspections deleted successfully", deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



app.use("/api", rigRoutes);
app.use("/api", inspectorRoutes);
app.use("/api", pdfRoutes);
// Listen on port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
