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

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    const pageWidth = doc.page.width - 100;

    // ===== Color Palette =====
    const colors = {
      primary: "#0B4C6C",
      secondary: "#2C7A9B",
      lightBg: "#F0F7FB",
      border: "#D1E7F0",
      text: "#2C3E50",
      textLight: "#7F8C8D",
      priority: {
        Low: "#28a745",
        Medium: "#ffc107",
        High: "#fd7e14",
        Urgent: "#dc3545",
      },
      status: {
        Pending: "#6c757d",
        "In Progress": "#17a2b8",
        Completed: "#28a745",
      }
    };

    // ===== Helper Functions =====
    const drawBox = (x, y, width, height, fillColor, strokeColor) => {
      doc.rect(x, y, width, height).fillAndStroke(fillColor, strokeColor);
    };

    const addSectionHeader = (title) => {
      doc.moveDown(1);
      const y = doc.y;
      
      // Background bar
      drawBox(50, y - 5, pageWidth, 30, colors.lightBg, colors.border);
      
      // Title
      doc
        .fontSize(16)
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .text(title, 60, y + 3);
      
      doc.moveDown(1.5);
    };

    // ===== Header =====
    const headerY = 40;
    drawBox(50, headerY, pageWidth, 80, colors.primary, colors.primary);

    doc
      .fillColor("white")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("INSPECTION REPORT", 50, headerY + 20, {
        align: "center",
        width: pageWidth,
      });

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("white")
      .text("Comprehensive Inspection Analysis & Documentation", {
        align: "center",
      });

    doc.y = headerY + 100;

    // ===== Report Metadata Card =====
    const metaY = doc.y;
    drawBox(50, metaY, pageWidth, 65, colors.lightBg, colors.border);

    doc.fontSize(9).fillColor(colors.textLight).font("Helvetica");
    
    const col1X = 65;
    const col2X = 320;
    
    doc.text("Report ID:", col1X, metaY + 15);
    doc.font("Helvetica-Bold").fillColor(colors.text).text(inspection._id, col1X, metaY + 28);
    
    doc.font("Helvetica").fillColor(colors.textLight);
    doc.text("Generated:", col2X, metaY + 15);
    doc.font("Helvetica-Bold").fillColor(colors.text).text(new Date().toLocaleString(), col2X, metaY + 28);

    doc.font("Helvetica").fillColor(colors.textLight);
    doc.text("Last Updated:", col1X, metaY + 45);
    doc.font("Helvetica-Bold").fillColor(colors.text).text(new Date(inspection.updatedAt).toLocaleString(), col1X + 70, metaY + 45);

    doc.y = metaY + 80;

    // ===== Inspection Overview Section =====
    addSectionHeader("Inspection Overview");

    const overviewY = doc.y;
    drawBox(50, overviewY, pageWidth, 85, "#FFFFFF", colors.border);

    // Title
    doc
      .fontSize(16)
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .text(inspection.title, 65, overviewY + 15, { width: pageWidth - 30 });
    
    doc.moveDown(0.3);
    
    // Rig
    doc
      .fontSize(11)
      .fillColor(colors.textLight)
      .font("Helvetica")
      .text("Rig:", 65, doc.y, { continued: true });
    
    doc
      .font("Helvetica-Bold")
      .fillColor(colors.text)
      .text(` ${inspection.rig}`);

    doc.y = overviewY + 100;

    // ===== Description Section =====
    addSectionHeader("Description");

    const descY = doc.y;
    const descHeight = Math.min(100, Math.ceil(inspection.description.length / 2.5) + 30);
    drawBox(50, descY, pageWidth, descHeight, "#FFFFFF", colors.border);
    
    doc
      .fontSize(11)
      .fillColor(colors.text)
      .font("Helvetica")
      .text(inspection.description, 65, descY + 15, {
        width: pageWidth - 30,
        align: "justify",
        lineGap: 3,
      });

    doc.y = descY + descHeight + 15;

    // ===== Key Details Grid =====
    addSectionHeader("Status & Priority");

    const gridY = doc.y;
    const boxHeight = 90;
    const boxWidth = (pageWidth - 15) / 2;

    // Priority Box
    drawBox(50, gridY, boxWidth, boxHeight, "#FFFFFF", colors.border);
    doc
      .fontSize(10)
      .fillColor(colors.textLight)
      .font("Helvetica-Bold")
      .text("PRIORITY LEVEL", 65, gridY + 15);
    
    const priorityColor = colors.priority[inspection.priority] || colors.text;
    doc
      .fontSize(24)
      .fillColor(priorityColor)
      .font("Helvetica-Bold")
      .text(inspection.priority, 65, gridY + 40);

    // Status Box
    drawBox(50 + boxWidth + 15, gridY, boxWidth, boxHeight, "#FFFFFF", colors.border);
    doc
      .fontSize(10)
      .fillColor(colors.textLight)
      .font("Helvetica-Bold")
      .text("CURRENT STATUS", 65 + boxWidth + 15, gridY + 15);
    
    const statusColor = colors.status[inspection.status] || colors.textLight;
    doc
      .fontSize(24)
      .fillColor(statusColor)
      .font("Helvetica-Bold")
      .text(inspection.status || "Pending", 65 + boxWidth + 15, gridY + 40);

    doc.y = gridY + boxHeight + 20;

    // ===== Schedule Information =====
    addSectionHeader("Schedule Information");

    const scheduleY = doc.y;
    drawBox(50, scheduleY, pageWidth, 75, colors.lightBg, colors.border);

    const scheduleDate = new Date(inspection.scheduleDate);
    const formattedDate = scheduleDate.toLocaleDateString("en-US", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    doc.fontSize(11).fillColor(colors.text).font("Helvetica");
    doc.text("Scheduled Date:", 65, scheduleY + 15);
    doc.font("Helvetica-Bold").fillColor(colors.primary).fontSize(12).text(formattedDate, 65, scheduleY + 32);

    doc.font("Helvetica").fillColor(colors.text).fontSize(11);
    doc.text("Estimated Duration:", 65, scheduleY + 52);
    doc.font("Helvetica-Bold").fillColor(colors.primary).fontSize(12).text(`${inspection.estimatedDuration} hours`, 195, scheduleY + 52);

    doc.y = scheduleY + 90;

    // ===== Inspectors Section =====
    addSectionHeader("Assigned Inspectors");

    const inspectorY = doc.y;
    const inspectorCount = inspection.inspectors.length;
    const inspectorBoxHeight = Math.max(80, inspectorCount * 28 + 30);
    
    drawBox(50, inspectorY, pageWidth, inspectorBoxHeight, "#FFFFFF", colors.border);

    let currentY = inspectorY + 20;
    inspection.inspectors.forEach((inspector, idx) => {
      const isCompleted = inspection.status === "Completed";
      const bullet = isCompleted ? String.fromCharCode(8226) : String.fromCharCode(9702);
      const bulletColor = isCompleted ? colors.priority.Low : colors.textLight;

      doc
        .fontSize(14)
        .fillColor(bulletColor)
        .font("Helvetica-Bold")
        .text(bullet, 65, currentY, { continued: true });

      doc
        .fontSize(11)
        .fillColor(colors.text)
        .font("Helvetica")
        .text(`  ${inspector}`, { continued: false });

      currentY += 28;
    });

    doc.y = currentY + 10;

    // ===== Footer =====
    const footerY = doc.page.height - 70;
    
    doc
      .moveTo(50, footerY)
      .lineTo(doc.page.width - 50, footerY)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(9)
      .fillColor(colors.textLight)
      .font("Helvetica")
      .text(
        "Generated by Inspection Management System",
        50,
        footerY + 15,
        { align: "center", width: pageWidth }
      );

    doc
      .fontSize(8)
      .fillColor(colors.textLight)
      .text(
        "Confidential Document - Page 1",
        50,
        footerY + 30,
        { align: "center", width: pageWidth }
      );

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;