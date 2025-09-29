import express from "express";
import Rig from "../models/Rig.js"; 

const router = express.Router();

// GET all rigs
router.get("/rigs", async (req, res) => {
  try {
    const rigs = await Rig.find();
    res.json(rigs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single rig by ID
router.get("/rigs/:id", async (req, res) => {
  try {
    const rig = await Rig.findById(req.params.id);
    if (!rig) {
      return res.status(404).json({ error: "Rig not found" });
    }
    res.json(rig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new rig
router.post("/rigs", async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: "Name and location are required" });
    }

    const newRig = new Rig({ name, location });
    const savedRig = await newRig.save();
    res.status(201).json(savedRig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update rig by ID
router.put("/rigs/:id", async (req, res) => {
  try {
    const { name, location } = req.body;
    const updatedRig = await Rig.findByIdAndUpdate(
      req.params.id,
      { name, location },
      { new: true, runValidators: true }
    );

    if (!updatedRig) {
      return res.status(404).json({ error: "Rig not found" });
    }

    res.json(updatedRig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE rig by ID
router.delete("/rigs/:id", async (req, res) => {
  try {
    const deletedRig = await Rig.findByIdAndDelete(req.params.id);

    if (!deletedRig) {
      return res.status(404).json({ error: "Rig not found" });
    }

    res.json({ message: "Rig deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
