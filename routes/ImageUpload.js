// routes/ImageUpload.js
import express from "express";
import { upload, uploadToGridFS, getImageStream } from "../config/gridfs.js";
import { verifyAdmin } from "../middleware/authMiddleware.js";


const router = express.Router();

// Upload multiple images
router.post("/upload/images",verifyAdmin, upload.array("photos", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }
``
    const ids = [];
    for (let file of req.files) {
      const id = await uploadToGridFS(file);
      ids.push(id);
    }

    res.json({ photoIds: ids });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

// Serve image by ID
router.get("/images/:id", async (req, res) => {
  try {
    const stream = getImageStream(req.params.id);
    stream.on("error", () => res.status(404).json({ error: "Image not found" }));
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Could not load image" });
  }
});

export default router;
