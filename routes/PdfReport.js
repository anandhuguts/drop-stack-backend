    import express from "express";
    import PDFDocument from "pdfkit";

    const router = express.Router();

    const PDFHelpers = {
    addSectionHeader(doc, title, subtitle) {
        doc.moveDown(1);
        doc.fontSize(14).font("Helvetica-Bold").fillColor("#1A252F")
        .text(title.toUpperCase(), { align: "left" });
        if (subtitle) {
        doc.fontSize(9).font("Helvetica").fillColor("#718096")
            .text(subtitle, { align: "left" });
        }
        doc.moveTo(40, doc.y + 4).lineTo(doc.page.width - 40, doc.y + 4)
        .strokeColor("#E2E8F0").lineWidth(0.5).stroke();
        doc.moveDown(0.5);
    },

    addKeyValuePair(doc, x, y, width, key, value) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#4A5568")
        .text(`${key}:`, x, y, { width: width * 0.35, continued: true });
        doc.font("Helvetica").fillColor("#1A202C").text(value, { width: width * 0.65 });
    },

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
    }
    };

    router.post("/inspections/pdf", async (req, res) => {
    try {
        const inspections = req.body.inspections;
        if (!inspections || !inspections.length) {
        return res.status(400).json({ error: "No inspections provided" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
        "Content-Disposition",
        `attachment; filename=inspection_report_${Date.now()}.pdf`
        );

        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.pipe(res);

        // Title
        doc.fontSize(22).font("Helvetica-Bold").fillColor("#1A252F")
        .text("Inspections Report", { align: "center" });
        doc.moveDown(0.2)
        .fontSize(10).font("Helvetica").fillColor("#4A5568")
        .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });
        doc.moveDown(1);

        inspections.forEach((insp, idx) => {
        PDFHelpers.addSectionHeader(doc, `Inspection ${idx + 1}: ${insp.title}`, `ID: ${insp.inspectionId}`);

        let y = doc.y;
        const pageWidth = doc.page.width - 90;

        // Key details
        PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Rig", insp.rig); y += 14;
        PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Priority", insp.priority); y += 14;
        PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Status", insp.status); y += 14;
        PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Completion Rate", insp.completionRate + "%"); y += 14;
        PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Scheduled Date", PDFHelpers.formatDate(insp.scheduleDate)); y += 14;
        PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Duration", `${insp.estimatedDuration} hours`); y += 14;

        // Inspectors
        if (insp.inspectors && insp.inspectors.length) {
            PDFHelpers.addKeyValuePair(doc, 50, y, pageWidth, "Inspectors", insp.inspectors.join(", "));
            y += 14;
        }

        // Description
        if (insp.description) {
            doc.moveDown(0.3);
            doc.fontSize(10).font("Helvetica-Bold").fillColor("#4A5568").text("Description:", { continued: false });
            doc.fontSize(10).font("Helvetica").fillColor("#1A202C").text(insp.description, { align: "justify" });
            doc.moveDown(0.5);
        }

        // Separator line between inspections
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y)
            .strokeColor("#E2E8F0").lineWidth(0.5).stroke();
        doc.moveDown(0.5);

        // Add a page if space is not enough
        if (doc.y > doc.page.height - 100) doc.addPage();
        });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
    });

    export default router;
