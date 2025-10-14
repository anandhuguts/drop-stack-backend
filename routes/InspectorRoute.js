import express from "express";
import Inspector from "../models/Inspector.js";

const router = express.Router();

// GET all inspectors
router.get("/inspectors", async (req, res) => {
  try {
    const inspectors = await Inspector.find();
    res.json(inspectors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a single inspector by ID
router.get("/inspectors/:id", async (req, res) => {
  try {
    const inspector = await Inspector.findById(req.params.id);
    if (!inspector) return res.status(404).json({ error: "Inspector not found" });
    res.json(inspector);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new inspector
router.post("/inspectors", async (req, res) => {
  try {
    const { name, username, email, password, specialties } = req.body;
    const newInspector = new Inspector({ name, username, email, password, specialties });
    const savedInspector = await newInspector.save();
    res.status(201).json(savedInspector);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (edit) inspector by ID
router.put("/inspectors/:id", async (req, res) => {
  try {
    const { name, username, email, password, specialties } = req.body;

    // Build update object dynamically to avoid overwriting password if blank
    const updateData = { name, username, email, specialties };
    if (password) updateData.password = password;

    const updatedInspector = await Inspector.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedInspector) return res.status(404).json({ error: "Inspector not found" });
    res.json(updatedInspector);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE inspector by ID
router.delete("/inspectors/:id", async (req, res) => {
  try {
    const deletedInspector = await Inspector.findByIdAndDelete(req.params.id);
    if (!deletedInspector) return res.status(404).json({ error: "Inspector not found" });
    res.json({ message: "Inspector deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
