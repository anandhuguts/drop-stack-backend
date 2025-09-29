import express from "express";
import PDFDocument from "pdfkit";
import Inspection from "../models/Inspection.js";

const router = express.Router();

// GET /api/inspections/:id/pdf
router.get("/inspections/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = await Inspection.findById(id);

    if (!inspection) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    // PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=inspection_${inspection._id}.pdf`
    );

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // ===== Header =====
    doc
      .fontSize(22)
      .fillColor("#0B4C6C")
      .text("Inspection Report", { align: "center" });
    doc.moveDown(1.5);

    // ===== Priority Colors =====
    const priorityColors = {
      Low: "#28a745",
      Medium: "#ffc107",
      High: "#fd7e14",
      Urgent: "#dc3545",
    };

    // ===== Basic Info =====
    doc.fontSize(14).fillColor("black");
    doc.text(`Title: ${inspection.title}`);
    doc.text(`Rig: ${inspection.rig}`);
    doc.text(`Description: ${inspection.description}`);
    doc.text("Priority: ")
      .fillColor(priorityColors[inspection.priority] || "black")
      .text(inspection.priority, { continued: false });
    doc.fillColor("black").text(`Status: ${inspection.status || "pending"}`);
    doc.text(
      `Scheduled Date: ${new Date(inspection.scheduleDate).toLocaleDateString()}`
    );
    doc.text(`Estimated Duration: ${inspection.estimatedDuration} hrs`);
    doc.moveDown();

    // ===== Inspectors =====
    doc.fontSize(14).fillColor("black").text("Inspectors:", { underline: true });
    inspection.inspectors.forEach((inspector, idx) => {
      const statusIcon = inspection.status === "completed" ? "✔️" : "⬜";
      doc.text(`${statusIcon} ${idx + 1}. ${inspector}`);
    });

    doc.moveDown();

    // ===== Footer =====
    doc
      .fontSize(10)
      .fillColor("gray")
      .text(
        `Created At: ${inspection.createdAt} | Updated At: ${inspection.updatedAt}`,
        { align: "center" }
      );

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
