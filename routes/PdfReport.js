import express from "express";
import PDFDocument from "pdfkit";

const router = express.Router();

// ================= PDF CONFIGURATION =================
const PDF_CONFIG = {
  colors: {
    primary: "#2563EB", // Modern blue
    dark: "#1E293B",
    medium: "#64748B",
    light: "#94A3B8",
    headerBg: "#0F172A",
    border: "#E2E8F0",
    rowEven: "#F8FAFC",
    rowOdd: "#FFFFFF",
    status: {
      PASS: "#10B981",
      FAIL: "#EF4444",
      PENDING: "#F59E0B",
      OTHER: "#6B7280"
    }
  },
  fonts: {
    bold: "Helvetica-Bold",
    regular: "Helvetica"
  }
};

// ================= PDF HELPERS =================
const PDFHelpers = {
  formatDate(dateString) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  truncateText(text, maxLength = 25) {
    if (!text) return "—";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  },

  addHeader(doc) {
    const headerHeight = 80;
    
    // Background gradient effect
    doc.rect(0, 0, doc.page.width, headerHeight)
       .fill(PDF_CONFIG.colors.headerBg);
    
    // Company logo placeholder or title
    doc.fillColor("#FFFFFF")
       .font(PDF_CONFIG.fonts.bold)
       .fontSize(24)
       .text("INSPECTION REPORT", 0, 25, { align: "center", width: doc.page.width });
    
    doc.fillColor(PDF_CONFIG.colors.light)
       .font(PDF_CONFIG.fonts.regular)
       .fontSize(10)
       .text(`Generated: ${new Date().toLocaleString("en-US", { 
         dateStyle: "medium", 
         timeStyle: "short" 
       })}`, 0, 52, { align: "center", width: doc.page.width });
    
    return headerHeight + 20;
  },

  addTableHeader(doc, x, y, columns) {
    const headerHeight = 28;
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    
    // Header background with rounded top corners effect
    doc.rect(x, y, totalWidth, headerHeight)
       .fill(PDF_CONFIG.colors.headerBg);
    
    // Column headers
    let currentX = x;
    columns.forEach((col, idx) => {
      // Vertical separator lines between columns
      if (idx > 0) {
        doc.moveTo(currentX, y)
           .lineTo(currentX, y + headerHeight)
           .strokeColor("#334155")
           .lineWidth(1)
           .stroke();
      }
      
      doc.fillColor("#FFFFFF")
         .fontSize(9)
         .font(PDF_CONFIG.fonts.bold)
         .text(col.header, currentX + 8, y + 9, {
           width: col.width - 16,
           align: col.align || "left",
         });
      
      currentX += col.width;
    });
    
    return y + headerHeight;
  },

  addTableRow(doc, x, y, columns, data, isEven = false) {
    const rowHeight = 32;
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const bgColor = isEven ? PDF_CONFIG.colors.rowEven : PDF_CONFIG.colors.rowOdd;
    
    // Row background
    doc.rect(x, y, totalWidth, rowHeight)
       .fill(bgColor);
    
    // Row border
    doc.rect(x, y, totalWidth, rowHeight)
       .strokeColor(PDF_CONFIG.colors.border)
       .lineWidth(0.5)
       .stroke();
    
    // Cell content
    let currentX = x;
    columns.forEach((col, idx) => {
      // Vertical separator
      if (idx > 0) {
        doc.moveTo(currentX, y)
           .lineTo(currentX, y + rowHeight)
           .strokeColor(PDF_CONFIG.colors.border)
           .lineWidth(0.5)
           .stroke();
      }
      
      const value = data[col.key] || "—";
      
      if (col.key === "Status") {
        // Status badge
        const color = PDF_CONFIG.colors.status[value] || PDF_CONFIG.colors.status.OTHER;
        const badgeWidth = 70;
        const badgeHeight = 18;
        const badgeX = currentX + (col.width - badgeWidth) / 2;
        const badgeY = y + (rowHeight - badgeHeight) / 2;
        
        // Badge with rounded corners
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3)
           .fill(color);
        
        doc.fillColor("#FFFFFF")
           .font(PDF_CONFIG.fonts.bold)
           .fontSize(8)
           .text(value, badgeX, badgeY + 5, { 
             width: badgeWidth, 
             align: "center" 
           });
      } else {
        // Regular text
        doc.fillColor(PDF_CONFIG.colors.dark)
           .font(PDF_CONFIG.fonts.regular)
           .fontSize(8.5)
           .text(value, currentX + 8, y + 10, {
             width: col.width - 16,
             align: col.align || "left",
             ellipsis: true
           });
      }
      
      currentX += col.width;
    });
    
    return y + rowHeight;
  },

  addSummaryBox(doc, x, y, inspections) {
    const boxWidth = 250;
    const boxHeight = 60;
    
    // Summary box with shadow effect
    doc.roundedRect(x + 2, y + 2, boxWidth, boxHeight, 4)
       .fill("#94A3B8");
    
    doc.roundedRect(x, y, boxWidth, boxHeight, 4)
       .fillAndStroke(PDF_CONFIG.colors.rowEven, PDF_CONFIG.colors.border);
    
    doc.fillColor(PDF_CONFIG.colors.dark)
       .font(PDF_CONFIG.fonts.bold)
       .fontSize(10)
       .text("Summary", x + 15, y + 12);
    
    const statusCounts = inspections.reduce((acc, i) => {
      acc[i.Status || "PENDING"] = (acc[i.Status || "PENDING"] || 0) + 1;
      return acc;
    }, {});
    
    let summaryY = y + 30;
    Object.entries(statusCounts).forEach(([status, count]) => {
      const color = PDF_CONFIG.colors.status[status] || PDF_CONFIG.colors.status.OTHER;
      
      doc.circle(x + 20, summaryY + 3, 4)
         .fill(color);
      
      doc.fillColor(PDF_CONFIG.colors.dark)
         .font(PDF_CONFIG.fonts.regular)
         .fontSize(9)
         .text(`${status}: ${count}`, x + 30, summaryY);
      
      summaryY += 12;
    });
    
    return y + boxHeight + 20;
  },

  addFooter(doc, pageNum, totalPages) {
    const footerY = doc.page.height - 35;
    
    // Footer line
    doc.moveTo(30, footerY - 10)
       .lineTo(doc.page.width - 30, footerY - 10)
       .strokeColor(PDF_CONFIG.colors.border)
       .lineWidth(1)
       .stroke();
    
    // Footer text
    doc.fillColor(PDF_CONFIG.colors.medium)
       .font(PDF_CONFIG.fonts.regular)
       .fontSize(8)
       .text(
         "Inspection Management System • Confidential Document",
         30,
         footerY,
         { width: doc.page.width - 60, align: "center" }
       );
    
    // Page number
    doc.fillColor(PDF_CONFIG.colors.medium)
       .fontSize(8)
       .text(`Page ${pageNum} of ${totalPages}`, 30, footerY, {
         align: "right",
         width: doc.page.width - 60,
       });
  }
};

// ================= PDF ROUTE =================
router.post("/inspections/pdf", async (req, res) => {
  try {
    const inspections = req.body.inspections;
    if (!inspections?.length) {
      return res.status(400).json({ error: "No inspections provided" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=inspection_report_${Date.now()}.pdf`
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 100, bottom: 50, left: 30, right: 30 },
      bufferPages: true,
    });

    doc.pipe(res);

    // Add header
    const startY = PDFHelpers.addHeader(doc);
    
    // Add summary box
    const summaryY = PDFHelpers.addSummaryBox(doc, 30, startY, inspections);
    
    doc.y = summaryY;

    // Table configuration
    const tableX = 30;
    let tableY = doc.y;
    
    const columns = [
      { key: "EquipNumber", header: "Equipment No", width: 95 },
      { key: "EquipmentName", header: "Equipment", width: 145 },
      { key: "AreaName", header: "Area", width: 90 },
      { key: "InspectorName", header: "Inspector", width: 115 },
      { key: "DateInspected", header: "Date", width: 85, align: "center" },
      { key: "Status", header: "Status", width: 80, align: "center" },
      { key: "Comments", header: "Comments", width: 152 },
    ];

    // Draw table header
    tableY = PDFHelpers.addTableHeader(doc, tableX, tableY, columns);

    // Draw rows
    inspections.forEach((inspection, idx) => {
      // Check for page break
      if (tableY > doc.page.height - 80) {
        doc.addPage();
        tableY = 50; // Start lower on new pages
        tableY = PDFHelpers.addTableHeader(doc, tableX, tableY, columns);
      }

      const rowData = {
        EquipNumber: PDFHelpers.truncateText(inspection.EquipNumber, 14),
        EquipmentName: PDFHelpers.truncateText(inspection.EquipmentName, 20),
        AreaName: PDFHelpers.truncateText(inspection.AreaName, 13),
        InspectorName: PDFHelpers.truncateText(inspection.InspectorName, 16),
        DateInspected: PDFHelpers.formatDate(inspection.DateInspected),
        Status: inspection.Status || "PENDING",
        Comments: PDFHelpers.truncateText(inspection.Comments || inspection.Observation, 35),
      };

      tableY = PDFHelpers.addTableRow(doc, tableX, tableY, columns, rowData, idx % 2 === 0);
    });

    // Add footers to all pages
    doc.flushPages();
    const range = doc.bufferedPageRange();

    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      PDFHelpers.addFooter(doc, i + 1, range.count);
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to generate PDF",
      details: error.message,
    });
  }
});

export default router;