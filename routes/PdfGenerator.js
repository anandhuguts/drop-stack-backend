import express from "express";
import PDFDocument from "pdfkit";
import Inspection from "../models/Inspection.js";

const router = express.Router();

// PDF Config - Modern, compact design with Montserrat-like sans-serif font
const PDF_CONFIG = {
  margins: { top: 50, bottom: 50, left: 40, right: 40 },
  colors: {
    primary: "#1A252F",       // Dark for headers
    text: { dark: "#1A202C", medium: "#4A5568", light: "#718096" },
    background: { card: "#FFFFFF" },
    border: "#E2E8F0",
    status: { pending: "#6B7280", "in-progress": "#3182CE", completed: "#2F855A", fail: "#C53030" },
    priority: { Low: "#2F855A", Medium: "#D97706", High: "#C53030", Urgent: "#9B2C2C" }
  },
  fonts: { header: "Helvetica-Bold", body: "Helvetica", bodyBold: "Helvetica-Bold" },
  spacing: { section: 15, line: 4 }
};

// Helpers
const PDFHelpers = {
  addSectionHeader(doc, title, subtitle) {
    doc.moveDown(1);
    doc.fontSize(14).font(PDF_CONFIG.fonts.header).fillColor(PDF_CONFIG.colors.primary)
       .text(title.toUpperCase(), { align: "left" });
    if (subtitle) {
      doc.fontSize(9).font(PDF_CONFIG.fonts.body).fillColor(PDF_CONFIG.colors.text.light)
         .text(subtitle, { align: "left" });
    }
    doc.moveTo(PDF_CONFIG.margins.left, doc.y + 4)
       .lineTo(doc.page.width - PDF_CONFIG.margins.right, doc.y + 4)
       .strokeColor(PDF_CONFIG.colors.border).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
  },

  createCard(doc, contentHeight) {
    const padding = 10;
    const height = contentHeight + padding * 2;
    doc.rect(PDF_CONFIG.margins.left, doc.y, doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right, height)
       .fillColor(PDF_CONFIG.colors.background.card).fill()
       .strokeColor(PDF_CONFIG.colors.border).lineWidth(0.5).stroke();
    return { x: PDF_CONFIG.margins.left + padding, y: doc.y + padding, width: doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right - padding * 2, height: height - padding * 2 };
  },

  addKeyValuePair(doc, x, y, width, key, value, options = {}) {
    const { valueColor = PDF_CONFIG.colors.text.dark, boldValue = false } = options;
    doc.fontSize(10).font(PDF_CONFIG.fonts.bodyBold).fillColor(PDF_CONFIG.colors.text.medium)
       .text(`${key}:`, x, y, { width: width * 0.35, continued: true });
    doc.font(boldValue ? PDF_CONFIG.fonts.bodyBold : PDF_CONFIG.fonts.body)
       .fillColor(valueColor).text(value, { width: width * 0.65 });
  },

  addBadge(doc, text, color, x, y) {
    const textWidth = doc.widthOfString(text.toUpperCase());
    const padding = 5, badgeWidth = textWidth + padding * 2, badgeHeight = 14;
    doc.rect(x - padding, y - 2, badgeWidth, badgeHeight).fillColor(color).fill();
    doc.fontSize(8).font(PDF_CONFIG.fonts.bodyBold).fillColor("#FFFFFF")
       .text(text.toUpperCase(), x - padding, y + 1, { align: "center", width: badgeWidth });
    return badgeWidth;
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  }
};

router.get("/inspections/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = await Inspection.findById(id);
    if (!inspection) return res.status(404).json({ error: "Inspection not found" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=inspection_${inspection._id}_${Date.now()}.pdf`);

    const doc = new PDFDocument({ margin: PDF_CONFIG.margins, size: "A4" });
    doc.pipe(res);

    // HEADER
    doc.fontSize(22).font(PDF_CONFIG.fonts.header).fillColor(PDF_CONFIG.colors.primary)
       .text("Inspection Report", { align: "center" });
    doc.moveDown(0.2)
       .fontSize(10).font(PDF_CONFIG.fonts.body).fillColor(PDF_CONFIG.colors.text.medium)
       .text(`Report ID: ${inspection._id}`, { align: "center" });
    doc.fontSize(8).fillColor(PDF_CONFIG.colors.text.light)
       .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });

    // OVERVIEW
    PDFHelpers.addSectionHeader(doc, "Overview", "Basic inspection information");
    let overviewCard = PDFHelpers.createCard(doc, 60);
    let y = overviewCard.y;
    PDFHelpers.addKeyValuePair(doc, overviewCard.x, y, overviewCard.width, "Title", inspection.title); y+=14;
    PDFHelpers.addKeyValuePair(doc, overviewCard.x, y, overviewCard.width, "Rig", inspection.rig); y+=18;
    doc.text("Priority:", overviewCard.x, y);
    PDFHelpers.addBadge(doc, inspection.priority, PDF_CONFIG.colors.priority[inspection.priority], overviewCard.x + 45, y);
    doc.text("Status:", overviewCard.x + 140, y);
    PDFHelpers.addBadge(doc, inspection.status, PDF_CONFIG.colors.status[inspection.status] || PDF_CONFIG.colors.text.medium, overviewCard.x + 180, y);
    doc.y = overviewCard.y + overviewCard.height + PDF_CONFIG.spacing.section;

    // DESCRIPTION
    if (inspection.description) {
      PDFHelpers.addSectionHeader(doc, "Description", null);
      let descCard = PDFHelpers.createCard(doc, Math.max(50, inspection.description.length/80*12));
      doc.fontSize(10).font(PDF_CONFIG.fonts.body).fillColor(PDF_CONFIG.colors.text.dark)
         .text(inspection.description, descCard.x, descCard.y, { width: descCard.width, lineGap: 2 });
      doc.y = descCard.y + descCard.height + PDF_CONFIG.spacing.section;
    }

    // SCHEDULE
    PDFHelpers.addSectionHeader(doc, "Schedule", null);
    let scheduleCard = PDFHelpers.createCard(doc, 40);
    y = scheduleCard.y;
    PDFHelpers.addKeyValuePair(doc, scheduleCard.x, y, scheduleCard.width, "Scheduled Date", PDFHelpers.formatDate(inspection.scheduleDate)); y+=14;
    PDFHelpers.addKeyValuePair(doc, scheduleCard.x, y, scheduleCard.width, "Duration", `${inspection.estimatedDuration} hours`);
    doc.y = scheduleCard.y + scheduleCard.height + PDF_CONFIG.spacing.section;

    // INSPECTORS
    if (inspection.inspectors && inspection.inspectors.length) {
      PDFHelpers.addSectionHeader(doc, "Assigned Inspectors", null);
      let inspCard = PDFHelpers.createCard(doc, inspection.inspectors.length*14);
      y = inspCard.y;
      inspection.inspectors.forEach((i, idx) => doc.fontSize(10).fillColor(PDF_CONFIG.colors.text.dark).text(`• ${i}`, inspCard.x, y + idx*14));
      doc.y = inspCard.y + inspCard.height + PDF_CONFIG.spacing.section;
    }

    // FOOTER
    const footerY = doc.page.height - 40;
    doc.moveTo(PDF_CONFIG.margins.left, footerY - 8).lineTo(doc.page.width - PDF_CONFIG.margins.right, footerY - 8)
       .strokeColor(PDF_CONFIG.colors.border).lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor(PDF_CONFIG.colors.text.light)
       .text("Generated by Inspection Management System • Confidential", PDF_CONFIG.margins.left, footerY, { align: "center", width: doc.page.width - 80 });
    doc.fontSize(7).text("Page 1 of 1", PDF_CONFIG.margins.left, footerY, { align: "right", width: doc.page.width - 80 });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF", details: err.message });
  }
});

export default router;
