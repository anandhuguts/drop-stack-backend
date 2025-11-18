// routes/reports.js
import express from "express";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

const router = express.Router();

// Helper: escape HTML
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Group inspections by area
function groupInspectionsByArea(inspections) {
  const grouped = {};

  inspections.forEach((inspection) => {
    const area = inspection.AreaName || "Uncategorized";
    if (!grouped[area]) {
      grouped[area] = [];
    }
    grouped[area].push(inspection);
  });

  return grouped;
}

// Build area sections HTML
function buildAreaSectionsHtml(groupedInspections, hostBase) {
  return Object.entries(groupedInspections)
    .map(([areaName, areaInspections]) => {
      const areaStats = buildSummaryStats(areaInspections);

      return `
      <div class="area-section">
        <!-- Area Header -->
        <div class="area-header">
          <h3 class="area-title">${escapeHtml(areaName)}</h3>
          <div class="area-stats">
            <span class="area-stat">Total: ${areaStats.total}</span>
            <span class="area-stat pass">Pass: ${areaStats.pass}</span>
            <span class="area-stat fail">Fail: ${areaStats.fail}</span>
            <span class="area-stat">Critical: ${areaStats.critical}</span>
            <span class="area-stat">Major: ${areaStats.major}</span>
            <span class="area-stat">Minor: ${areaStats.minor}</span>
          </div>
        </div>
        
        <!-- Area Inspection Boxes -->
        ${buildInspectionBoxesHtml(areaInspections, hostBase)}
      </div>
      `;
    })
    .join("\n");
}

// Build individual inspection boxes HTML
function buildInspectionBoxesHtml(inspections, hostBase) {
  return inspections
    .map((i, idx) => {
      const date =
        i.DateInspected || i.createdAt
          ? new Date(i.DateInspected || i.createdAt).toLocaleDateString("en-GB")
          : "—";
      const status = (i.Status || "PENDING").toUpperCase();
      const risk = escapeHtml(i.RiskName || "—");

      // Build photos for this inspection
      let photosHtml = "";
      if (Array.isArray(i.photos) && i.photos.length > 0) {
        const photoTags = i.photos
          .map((pid) => {
            const url = `${hostBase.replace(/\/$/, "")}/api/images/${pid}`;
            return `<img class="inspection-photo" src="${url}" alt="Photo" />`;
          })
          .join("");
        photosHtml = `<div class="photos-section">${photoTags}</div>`;
      }

      return `
      <div class="inspection-box">
        <!-- Header Row -->
        <div class="inspection-header">
          <div class="header-cell"><strong>Equipment No</strong><br/>${escapeHtml(
            i.EquipNumber || "—"
          )}</div>
          <div class="header-cell"><strong>Location Name</strong><br/>${escapeHtml(
            i.LocationName || "—"
          )}</div>
          <div class="header-cell"><strong>Equipment</strong><br/>${escapeHtml(
            i.EquipmentName || "—"
          )}</div>
          <div class="header-cell"><strong>Control</strong><br/>${escapeHtml(
            i.Control || "—"
          )}</div>
          <div class="header-cell"><strong>Risk</strong><br/><span class="badge risk-${risk
            .toLowerCase()
            .replace(/\s/g, "-")}">${risk}</span></div>
          <div class="header-cell"><strong>Environmental<br/>Factor</strong><br/>${escapeHtml(
            i.EnvironFactor || "—"
          )}</div>
          <div class="header-cell"><strong>Consequence</strong><br/>${escapeHtml(
            i.Consequence || "—"
          )}</div>
          <div class="header-cell"><strong>Serial No</strong><br/>${escapeHtml(
            i.SerialNo || "—"
          )}</div>
          <div class="header-cell"><strong>Status</strong><br/><span class="badge status-${status.toLowerCase()}">${status}</span></div>
          <div class="header-cell"><strong>Repaired<br/>Status</strong><br/>${escapeHtml(
            i.CARepairedStatus || "OPEN"
          )}</div>
          <div class="header-cell"><strong>Inspector</strong><br/>${escapeHtml(
            i.InspectorName || "—"
          )}</div>
          <div class="header-cell"><strong>Date</strong><br/>${date}</div>
        </div>
        
        <!-- Photos Section (if exists) -->
        ${photosHtml}
        
        <!-- Comments Section -->
        <div class="comments-row">
          ${
            i.PrimaryComments
              ? `
          <div class="comment-box">
            <div class="comment-label">Primary Comments</div>
            <div class="comment-text">${escapeHtml(i.PrimaryComments)}</div>
          </div>
          `
              : ""
          }
          
          ${
            i.SecondaryComments
              ? `
          <div class="comment-box">
            <div class="comment-label">Secondary Comments</div>
            <div class="comment-text">${escapeHtml(i.SecondaryComments)}</div>
          </div>
          `
              : ""
          }
          
          ${
            i.Comments || i.Observation
              ? `
          <div class="comment-box full-width">
            <div class="comment-label">Comments</div>
            <div class="comment-text">${escapeHtml(
              i.Comments || i.Observation || ""
            )}</div>
          </div>
          `
              : ""
          }
          
          ${
            i.LoadPathComments
              ? `
          <div class="comment-box full-width">
            <div class="comment-label">Load Path Comments</div>
            <div class="comment-text">${escapeHtml(i.LoadPathComments)}</div>
          </div>
          `
              : ""
          }
          
          ${
            i.SafetySecComments
              ? `
          <div class="comment-box full-width">
            <div class="comment-label">Safety Secondary Comments</div>
            <div class="comment-text">${escapeHtml(i.SafetySecComments)}</div>
          </div>
          `
              : ""
          }
          
          ${
            i.FasteningMethod
              ? `
          <div class="comment-box">
            <div class="comment-label">Fastening Method</div>
            <div class="comment-text">${escapeHtml(i.FasteningMethod)}</div>
          </div>
          `
              : ""
          }
          
          ${
            i.SecFastMethod
              ? `
          <div class="comment-box">
            <div class="comment-label">Secondary Fastening Method</div>
            <div class="comment-text">${escapeHtml(i.SecFastMethod)}</div>
          </div>
          `
              : ""
          }
        </div>
        
        ${
          i.Observation
            ? `
        <div class="observation-row">
          <div class="comment-label">Observation</div>
          <div class="comment-text">${escapeHtml(i.Observation)}</div>
        </div>
        `
            : ""
        }
      </div>
      `;
    })
    .join("\n");
}

// Build summary statistics
function buildSummaryStats(inspections) {
  const total = inspections.length;
  const pass = inspections.filter(
    (i) => i.Status?.toUpperCase() === "PASS"
  ).length;
  const fail = inspections.filter(
    (i) => i.Status?.toUpperCase() === "FAIL"
  ).length;
  const pending = inspections.filter(
    (i) => i.Status?.toUpperCase() === "PENDING"
  ).length;

  const critical = inspections.filter(
    (i) => i.RiskName?.toUpperCase() === "CRITICAL"
  ).length;
  const major = inspections.filter(
    (i) => i.RiskName?.toUpperCase() === "MAJOR"
  ).length;
  const minor = inspections.filter(
    (i) => i.RiskName?.toUpperCase() === "MINOR"
  ).length;

  return { total, pass, fail, pending, critical, major, minor };
}

// Generate chart images
async function generateCharts(groupedInspections) {
  const width = 800;
  const height = 500;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "white",
  });

  // Prepare data for area-wise risk chart
  const areaNames = Object.keys(groupedInspections);
  const criticalData = [];
  const majorData = [];
  const minorData = [];

  areaNames.forEach((area) => {
    const stats = buildSummaryStats(groupedInspections[area]);
    criticalData.push(stats.critical);
    majorData.push(stats.major);
    minorData.push(stats.minor);
  });

  // Area-wise Risk Chart (Stacked Bar)
  const riskChartConfig = {
    type: "bar",
    data: {
      labels: areaNames,
      datasets: [
        {
          label: "Critical",
          data: criticalData,
          backgroundColor: "#dc2626",
          borderColor: "#dc2626",
          borderWidth: 1,
        },
        {
          label: "Major",
          data: majorData,
          backgroundColor: "#f97316",
          borderColor: "#f97316",
          borderWidth: 1,
        },
        {
          label: "Minor",
          data: minorData,
          backgroundColor: "#eab308",
          borderColor: "#eab308",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Risk Classification by Area",
          font: { size: 18, weight: "bold" },
        },
        legend: {
          position: "top",
          labels: { font: { size: 14 } },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: "Count", font: { size: 14 } },
        },
        y: {
          stacked: true,
          ticks: { font: { size: 12 } },
        },
      },
    },
  };

  const riskChartBuffer = await chartJSNodeCanvas.renderToBuffer(
    riskChartConfig
  );
  const riskChartBase64 = riskChartBuffer.toString("base64");

  // Overall Status Pie Chart
  const allInspections = Object.values(groupedInspections).flat();
  const overallStats = buildSummaryStats(allInspections);

  const statusChartConfig = {
    type: "pie",
    data: {
      labels: ["Pass", "Fail", "Pending"],
      datasets: [
        {
          data: [overallStats.pass, overallStats.fail, overallStats.pending],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
          borderColor: ["#16a34a", "#dc2626", "#d97706"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Overall Status Distribution",
          font: { size: 18, weight: "bold" },
        },
        legend: {
          position: "bottom",
          labels: { font: { size: 14 } },
        },
      },
    },
  };

  const statusChartBuffer = await chartJSNodeCanvas.renderToBuffer(
    statusChartConfig
  );
  const statusChartBase64 = statusChartBuffer.toString("base64");

  // Risk Distribution Doughnut Chart
  const riskDistConfig = {
    type: "doughnut",
    data: {
      labels: ["Critical", "Major", "Minor"],
      datasets: [
        {
          data: [overallStats.critical, overallStats.major, overallStats.minor],
          backgroundColor: ["#dc2626", "#f97316", "#eab308"],
          borderColor: ["#991b1b", "#c2410c", "#a16207"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Risk Level Distribution",
          font: { size: 18, weight: "bold" },
        },
        legend: {
          position: "bottom",
          labels: { font: { size: 14 } },
        },
      },
    },
  };

  const riskDistBuffer = await chartJSNodeCanvas.renderToBuffer(riskDistConfig);
  const riskDistBase64 = riskDistBuffer.toString("base64");

  return {
    riskChart: `data:image/png;base64,${riskChartBase64}`,
    statusChart: `data:image/png;base64,${statusChartBase64}`,
    riskDistChart: `data:image/png;base64,${riskDistBase64}`,
  };
}

router.post("/reports/pdfSecondary", async (req, res) => {
  try {
    const inspections = Array.isArray(req.body.inspections)
      ? req.body.inspections
      : [];
    const hostBase =
      req.body.hostBase || `http://localhost:${process.env.PORT || 5000}`;

    if (inspections.length === 0) {
      return res.status(400).json({ error: "No inspections provided" });
    }

    // Group inspections by area
    const groupedInspections = groupInspectionsByArea(inspections);
    const areaSectionsHtml = buildAreaSectionsHtml(
      groupedInspections,
      hostBase
    );

    const stats = buildSummaryStats(inspections);

    // Generate charts
    const charts = await generateCharts(groupedInspections);

    // Get project info from first inspection
    const projectInfo = {
      asset: inspections[0]?.AssetName || "E12C PROJECT",
      location: inspections[0]?.LocationName || "SERIA BRUNEI DARUSSALAM",
      client: "ELITE DRILLING SOUTH EAST ASIA",
      inspector: inspections[0]?.InspectorName || "Inspection Team",
      dateRange:
        inspections.length > 0
          ? `${new Date(
              inspections[0].DateInspected || inspections[0].createdAt
            ).toLocaleDateString("en-GB")} - ${new Date(
              inspections[inspections.length - 1].DateInspected ||
                inspections[inspections.length - 1].createdAt
            ).toLocaleDateString("en-GB")}`
          : new Date().toLocaleDateString("en-GB"),
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DROPS Survey Inspection Report</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    /* Page Container */
    .page {
      padding: 15mm 12mm;
    }
    
    .page-with-header {
      padding-top: 20mm;
    }
    
    /* Cover Page */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      page-break-after: always;
      padding: 40px;
    }
    
    .cover-logo {
      width: 400px;
      height: 200px;
      margin-bottom: 40px;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 14pt;
    }
    
    .logo-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    .cover-title {
      font-size: 32pt;
      font-weight: bold;
      margin-bottom: 60px;
      color: #000;
    }
    
    .cover-date {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 40px;
    }
    
    .cover-client {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 30px;
      text-transform: uppercase;
    }
    
    .cover-project {
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 50px;
      text-transform: uppercase;
    }
    
    .cover-footer {
      font-size: 12pt;
      margin-top: 40px;
    }
    
    .cover-footer-line {
      font-weight: bold;
      margin-bottom: 20px;
    }
    
    .cover-footer-contact {
      color: #0088cc;
      font-size: 14pt;
    }
    
    /* Quality Assurance Page */
    .qa-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      padding: 40px;
    }
    
    .qa-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 60px;
    }
    
    .qa-logo-left, .qa-logo-right {
      width: 180px;
      height: 80px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
      color: #999;
    }
    
    .qa-title {
      text-align: center;
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 40px;
    }
    
    .qa-description {
      text-align: center;
      font-size: 11pt;
      margin-bottom: 60px;
    }
    
    .qa-signatures {
      width: 600px;
      margin: 0 auto 60px;
      border: 2px solid #000;
    }
    
    .qa-sig-header {
      text-align: center;
      padding: 12px;
      border-bottom: 2px solid #000;
      font-weight: bold;
    }
    
    .qa-sig-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 2px solid #000;
    }
    
    .qa-sig-row:last-child {
      border-bottom: none;
    }
    
    .qa-sig-cell {
      padding: 20px;
      text-align: center;
      border-right: 2px solid #000;
      font-weight: bold;
    }
    
    .qa-sig-cell:last-child {
      border-right: none;
    }
    
    .qa-footer {
      display: flex;
      justify-content: space-between;
      margin-top: auto;
      font-size: 9pt;
    }
    
    .qa-footer-item {
      margin-bottom: 8px;
    }
    
    .qa-footer-label {
      font-weight: bold;
      display: inline-block;
      width: 140px;
    }
    
    .qa-bottom-table {
      margin-top: 40px;
      width: 100%;
      border: 2px solid #000;
      border-collapse: collapse;
    }
    
    .qa-bottom-table td {
      padding: 12px;
      border: 1px solid #000;
      font-size: 9pt;
    }
    
    .qa-bottom-label {
      font-weight: bold;
      width: 120px;
    }
    
    /* Definitions Page */
    .definitions-page {
      page-break-after: always;
      padding: 40px;
    }
    
    .def-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    
    .def-logo {
      width: 120px;
      height: 60px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      color: #999;
    }
    
    .def-title {
      text-align: center;
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .def-subtitle {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 30px;
    }
    
    .def-section {
      margin-bottom: 30px;
    }
    
    .def-section-title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      padding: 10px;
      border: 2px solid #000;
      background: #f0f0f0;
    }
    
    .def-table {
      width: 100%;
      border: 2px solid #000;
      border-top: none;
      border-collapse: collapse;
    }
    
    .def-table tr {
      border-bottom: 2px solid #000;
    }
    
    .def-table tr:last-child {
      border-bottom: none;
    }
    
    .def-table td:first-child {
      width: 150px;
      padding: 12px;
      text-align: center;
      font-weight: bold;
      border-right: 2px solid #000;
    }
    
    .def-table td:last-child {
      padding: 12px;
    }
    
    .def-critical { color: #dc2626; }
    .def-major { color: #f97316; }
    .def-minor { color: #0066cc; }
    .def-observation { color: #22c55e; }
    .def-repaired { color: #f59e0b; }
    .def-pass { color: #22c55e; }
    .def-fail { color: #dc2626; }
    .def-no-access { color: #94a3b8; }
    
    .def-footer {
      margin-top: 30px;
      width: 100%;
      border: 2px solid #000;
      border-collapse: collapse;
    }
    
    .def-footer td {
      padding: 12px;
      border: 1px solid #000;
      font-size: 9pt;
    }
    
    .def-footer-label {
      font-weight: bold;
      width: 120px;
    }
    
    /* Analytics Page */
    .analytics-page {
      page-break-after: always;
      padding: 40px;
    }
    
    .analytics-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #003366;
    }
    
    .analytics-logo {
      width: 120px;
      height: 60px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      color: #999;
    }
    
    .analytics-title-section {
      flex: 1;
      text-align: center;
    }
    
    .analytics-main-title {
      font-size: 22pt;
      font-weight: bold;
      color: #003366;
      margin-bottom: 5px;
    }
    
    .analytics-subtitle {
      font-size: 12pt;
      color: #666;
    }
    
    .chart-container {
      margin-bottom: 40px;
      text-align: center;
    }
    
    .chart-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      background: white;
    }
    
    .chart-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    
    .analytics-footer {
      margin-top: auto;
      width: 100%;
      border: 2px solid #000;
      border-collapse: collapse;
    }
    
    .analytics-footer td {
      padding: 12px;
      border: 1px solid #000;
      font-size: 9pt;
    }
    
    .analytics-footer-label {
      font-weight: bold;
      width: 120px;
    }
    
    /* Report Header */
    .report-header {
      border: 2px solid #000;
      padding: 12px;
      margin-bottom: 20px;
      background: #f5f5f5;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #666;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    
    .header-logo {
      font-size: 18pt;
      font-weight: bold;
      color: #003366;
    }
    
    .header-title {
      text-align: right;
    }
    
    .header-title h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .header-title .subtitle {
      font-size: 9pt;
      color: #666;
    }
    
    .header-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 8pt;
    }
    
    .info-row {
      display: flex;
    }
    
    .info-label {
      font-weight: bold;
      width: 100px;
    }
    
    .info-value {
      flex: 1;
    }
    
    /* Summary Stats */
    .summary-stats {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .stat-box {
      border: 2px solid #003366;
      padding: 8px;
      text-align: center;
      background: white;
    }
    
    .stat-label {
      font-size: 7pt;
      font-weight: bold;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .stat-value {
      font-size: 16pt;
      font-weight: bold;
      color: #003366;
    }
    
    .stat-box.pass .stat-value { color: #22c55e; }
    .stat-box.fail .stat-value { color: #ef4444; }
    .stat-box.pending .stat-value { color: #f59e0b; }
    .stat-box.critical .stat-value { color: #dc2626; }
    .stat-box.major .stat-value { color: #f97316; }
    .stat-box.minor .stat-value { color: #eab308; }
    
    /* Section Headers */
    .section-header {
      margin: 30px 0 20px 0;
    }
    
    .section-header h2 {
      font-size: 12pt;
      font-weight: bold;
      color: #003366;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .section-line {
      height: 2px;
      background: #003366;
      margin-top: 4px;
    }
    
    /* Area Section Styles */
    .area-section {
      margin-bottom: 35px;
      page-break-inside: avoid;
    }
    
    .area-header {
      background: white;
      color: #000;
      padding: 15px 20px;
      margin-bottom: 16px;
      border: 2px solid #000;
      border-radius: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .area-title {
      font-size: 14pt;
      font-weight: bold;
      margin: 0;
      color: #000;
    }
    
    .area-stats {
      display: flex;
      gap: 18px;
      font-size: 9pt;
    }
    
    .area-stat {
      padding: 5px 10px;
      background: #f0f0f0;
      border-radius: 4px;
      font-weight: bold;
      color: #000;
    }
    
    .area-stat.pass { background: #22c55e; color: white; }
    .area-stat.fail { background: #ef4444; color: white; }
    
    /* Inspection Box Styles */
    .inspection-box {
      border: 2px solid #000;
      margin-bottom: 24px;
      page-break-inside: avoid;
      background: white;
    }
    
    .inspection-header {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      border-bottom: 2px solid #000;
    }
    
   .header-cell {
  padding: 14px 8px; /* More breathing space */
  border-right: 1px solid #000;
  font-size: 8pt;
  text-align: center;
  background: white;
  line-height: 1.35; /* Better vertical alignment */
  vertical-align: middle;
  min-height: 42px; /* Makes cells equally tall */
}

    
    .header-cell:last-child {
      border-right: none;
    }
    
   .header-cell strong {
  display: block;
  margin-bottom: 6px;
  font-size: 8pt;
  line-height: 1.2;
  color: #000;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.25px;
}

    /* Photos Section */
    .photos-section {
      display: flex;
      gap: 10px;
      padding: 15px;
      border-bottom: 2px solid #000;
      background: #fafafa;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    
    .inspection-photo {
      width: 180px;
      height: 180px;
      object-fit: cover;
      border: 2px solid #ccc;
      border-radius: 4px;
    }
    
    /* Comments Section */
    .comments-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0;
    }
    
    .comment-box {
      padding: 12px;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 8pt;
      min-height: 60px;
    }
    
    .comment-box:nth-child(2n) {
      border-right: none;
    }
    
    .comment-box.full-width {
      grid-column: 1 / -1;
      border-right: none;
    }
    
    .comment-label {
      font-weight: bold;
      margin-bottom: 6px;
      color: #000;
      font-size: 8pt;
      text-transform: uppercase;
    }
    
    .comment-text {
      font-size: 8pt;
      line-height: 1.4;
      color: #333;
    }
    
    .observation-row {
      padding: 12px;
      border-top: 2px solid #000;
      background: #fffbf0;
    }
    
    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      white-space: nowrap;
    }
    
    .status-pass { background: #22c55e; color: white; }
    .status-fail { background: #ef4444; color: white; }
    .status-pending { background: #f59e0b; color: white; }
    .status-other { background: #94a3b8; color: white; }
    
    .risk-critical { background: #dc2626; color: white; }
    .risk-major { background: #f97316; color: white; }
    .risk-minor { background: #eab308; color: white; }
    .risk-observation { background: #06b6d4; color: white; }
    .risk- { background: #94a3b8; color: white; }
    
    /* Footer */
    .report-footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 2px solid #003366;
      font-size: 7pt;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
    
    .footer-left {
      font-weight: bold;
    }
    
    .footer-right {
      text-align: right;
    }
    
    /* Page Break */
    .page-break {
      page-break-before: always;
    }
    
    /* Print Optimization */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .inspection-box { page-break-inside: avoid; }
      .area-section { page-break-inside: avoid; }
      .inspection-photo { -webkit-print-color-adjust: exact; }
      .area-header { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-logo">
      <img src="${hostBase}/static/e28805cb-6174-4d0d-960b-b4bef57acca3 (1).png" class="logo-img" alt="Company Logo" />
    </div>
    
    <div class="cover-title">Drops Register</div>
    
    <div class="cover-date">${new Date(
      inspections[0]?.DateInspected || Date.now()
    )
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      .toUpperCase()}</div>
    
    <div class="cover-client">${escapeHtml(
      projectInfo.client || "HAZTECH SOLUTIONS"
    )}</div>
    
    <div class="cover-project">${escapeHtml(projectInfo.asset)}</div>
    
    <div class="cover-footer">
      <div class="cover-footer-line">Inspection by OCS Group – Inspection Division</div>
      <div class="cover-footer-contact">www.ocsgroup.com | info@ocsgroup.com</div>
    </div>
  </div>

  <!-- Quality Assurance Page -->
  <div class="qa-page">
    <div class="qa-header">
      <div class="qa-logo-left">[OCS Logo]</div>
      <div class="qa-logo-right">[Client Logo]</div>
    </div>
    
    <div class="qa-title">QUALITY ASSURANCE</div>
    
    <div class="qa-description">
      The signatures below are to approve this document as accurate, and that it has been accepted for client distribution.
    </div>
    
    <div class="qa-signatures">
      <div class="qa-sig-header">(3 signatures required)</div>
      <div class="qa-sig-row">
        <div class="qa-sig-cell">PROJECT MANAGEMENT</div>
        <div class="qa-sig-cell"></div>
      </div>
      <div class="qa-sig-row">
        <div class="qa-sig-cell">QUALITY ASSURANCE</div>
        <div class="qa-sig-cell"></div>
      </div>
      <div class="qa-sig-row">
        <div class="qa-sig-cell">OPERATIONS</div>
        <div class="qa-sig-cell"></div>
      </div>
    </div>
    
    <div class="qa-footer">
      <div>
        <div class="qa-footer-item">
          <span class="qa-footer-label">Document Title:</span> Doc 1.0
        </div>
        <div class="qa-footer-item">
          <span class="qa-footer-label">Document Number:</span> 1
        </div>
      </div>
      <div>
        <div class="qa-footer-item">
          <span class="qa-footer-label">Revised By:</span> Anna
        </div>
        <div class="qa-footer-item">
          <span class="qa-footer-label">Revision:</span> Anna
        </div>
      </div>
      <div>
        <div class="qa-footer-item">
          <span class="qa-footer-label">Approved By:</span> Mark Tranfield
        </div>
        <div class="qa-footer-item">
          <span class="qa-footer-label">Approval Date:</span> 06-Nov-17
        </div>
      </div>
    </div>
    
    <table class="qa-bottom-table">
      <tr>
        <td class="qa-bottom-label">Asset</td>
        <td>${escapeHtml(projectInfo.asset)}</td>
        <td class="qa-bottom-label">Inspected By</td>
        <td>${escapeHtml(projectInfo.inspector)}</td>
        <td colspan="2">${escapeHtml(
          "www.ocsgroup.com | info@ocsgroup.com"
        )}</td>
      </tr>
      <tr>
        <td class="qa-bottom-label">Inspection Date</td>
        <td>${new Date(
          inspections[0]?.DateInspected || Date.now()
        ).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</td>
        <td class="qa-bottom-label">QA Review</td>
        <td>Anna</td>
        <td class="qa-bottom-label">Page No</td>
        <td>2</td>
      </tr>
    </table>
  </div>

  <!-- Definitions Page -->
  <div class="definitions-page">
    <div class="def-header">
      <div class="def-logo">[Client Logo]</div>
    </div>
    
    <div class="def-title">DROPS AREA EQUIPMENT REGISTER</div>
    <div class="def-subtitle">DEFINITIONS</div>
    
    <div class="def-section">
      <div class="def-section-title">FAULT CLASSIFICATION</div>
      <table class="def-table">
        <tr>
          <td class="def-critical">CRITICAL</td>
          <td>A defect identified in Zone 0 that compromises the hazardous area design and integrity of the equipment that if left uncorrected may lead equipment failure, Asset damage, personal injury or death. See example sheet.</td>
        </tr>
        <tr>
          <td class="def-major">MAJOR</td>
          <td>A defect identified in Zone 1 that could compromise the integrity of the equipment, that if left uncorrected may lead to equipment failure, Asset damage, personal injury or death. See example sheet.</td>
        </tr>
        <tr>
          <td class="def-minor">MINOR</td>
          <td>A defect identified in Zone 2 that compromises the regulatory suitability of the equipment. See example sheet.</td>
        </tr>
        <tr>
          <td class="def-observation">OBSERVATION</td>
          <td>A significant detail, not to be considered a defect, but still worthy of notation.</td>
        </tr>
        <tr>
          <td class="def-repaired">REPAIRED</td>
          <td>An identified defect, either Critical, Major or Minor, that has since been repaired by competent personnel and re-inspected, and is no longer considered a defect.</td>
        </tr>
      </table>
    </div>
    
    <div class="def-section">
      <div class="def-section-title">STATUS</div>
      <table class="def-table">
        <tr>
          <td class="def-pass">PASS</td>
          <td>Equipment found to be in good working order, acceptable for the area installed.</td>
        </tr>
        <tr>
          <td class="def-fail">FAIL</td>
          <td>Equipment found to be in poor condition, or unacceptable for the area installed.</td>
        </tr>
        <tr>
          <td class="def-no-access">NO ACCESS</td>
          <td>Equipment was unable to be inspected due to lack of access.</td>
        </tr>
      </table>
    </div>
    
    <table class="def-footer">
      <tr>
        <td class="def-footer-label">Asset</td>
        <td>${escapeHtml(projectInfo.asset)}</td>
        <td class="def-footer-label">Inspected By</td>
        <td>${escapeHtml(projectInfo.inspector)}</td>
        <td colspan="2">${escapeHtml(
          "www.ocsgroup.com | info@ocsgroup.com"
        )}</td>
      </tr>
      <tr>
        <td class="def-footer-label">Inspection Date</td>
        <td>${new Date(
          inspections[0]?.DateInspected || Date.now()
        ).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</td>
        <td class="def-footer-label">QA Review</td>
        <td>Anna</td>
        <td class="def-footer-label">Page No</td>
        <td>3</td>
      </tr>
    </table>
  </div>

  <!-- Analytics Page with Charts -->
  <div class="analytics-page">
    <div class="analytics-header">
      <div class="analytics-logo">[Client Logo]</div>
      <div class="analytics-title-section">
        <div class="analytics-main-title">INSPECTION ANALYTICS</div>
        <div class="analytics-subtitle">Visual Summary of Risk and Status Distribution</div>
      </div>
      <div class="analytics-logo">[OCS Logo]</div>
    </div>
    
    <!-- Main Area Risk Chart -->
    <div class="chart-container">
      <img src="${charts.riskChart}" alt="Risk Classification by Area" />
    </div>
    
    <!-- Status and Risk Distribution Grid -->
    <div class="chart-grid">
      <div class="chart-container">
        <img src="${charts.statusChart}" alt="Overall Status Distribution" />
      </div>
      <div class="chart-container">
        <img src="${charts.riskDistChart}" alt="Risk Level Distribution" />
      </div>
    </div>
    
    <table class="analytics-footer">
      <tr>
        <td class="analytics-footer-label">Asset</td>
        <td>${escapeHtml(projectInfo.asset)}</td>
        <td class="analytics-footer-label">Inspected By</td>
        <td>${escapeHtml(projectInfo.inspector)}</td>
        <td colspan="2">${escapeHtml(
          "www.ocsgroup.com | info@ocsgroup.com"
        )}</td>
      </tr>
      <tr>
        <td class="analytics-footer-label">Inspection Date</td>
        <td>${new Date(
          inspections[0]?.DateInspected || Date.now()
        ).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</td>
        <td class="analytics-footer-label">QA Review</td>
        <td>Anna</td>
        <td class="analytics-footer-label">Page No</td>
        <td>4</td>
      </tr>
    </table>
  </div>

  <!-- Data Pages -->
  <div class="page page-with-header">
    <!-- Header -->
    <div class="report-header">
      <div class="header-top">
        <div class="header-logo">OCS GROUP</div>
        <div class="header-title">
          <h1>DROPS SURVEY INSPECTION REPORT</h1>
          <div class="subtitle">Dropped Objects Prevention Scheme</div>
        </div>
      </div>
      <div class="header-info">
        <div class="info-row">
          <div class="info-label">Asset:</div>
          <div class="info-value">${escapeHtml(projectInfo.asset)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Location:</div>
          <div class="info-value">${escapeHtml(projectInfo.location)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Client:</div>
          <div class="info-value">${escapeHtml(projectInfo.client)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Inspector:</div>
          <div class="info-value">${escapeHtml(projectInfo.inspector)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Inspection Period:</div>
          <div class="info-value">${projectInfo.dateRange}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Report Generated:</div>
          <div class="info-value">${new Date().toLocaleDateString(
            "en-GB"
          )} ${new Date().toLocaleTimeString("en-GB")}</div>
        </div>
      </div>
    </div>

    <!-- Summary Statistics -->
    <div class="summary-stats">
      <div class="stat-box">
        <div class="stat-label">Total Items</div>
        <div class="stat-value">${stats.total}</div>
      </div>
      <div class="stat-box pass">
        <div class="stat-label">Pass</div>
        <div class="stat-value">${stats.pass}</div>
      </div>
      <div class="stat-box fail">
        <div class="stat-label">Fail</div>
        <div class="stat-value">${stats.fail}</div>
      </div>
      <div class="stat-box pending">
        <div class="stat-label">Pending</div>
        <div class="stat-value">${stats.pending}</div>
      </div>
      <div class="stat-box critical">
        <div class="stat-label">Critical</div>
        <div class="stat-value">${stats.critical}</div>
      </div>
      <div class="stat-box major">
        <div class="stat-label">Major</div>
        <div class="stat-value">${stats.major}</div>
      </div>
      <div class="stat-box minor">
        <div class="stat-label">Minor</div>
        <div class="stat-value">${stats.minor}</div>
      </div>
    </div>

    <!-- Area-wise Inspection Sections -->
    <div class="section-header">
      <h2>CORRECTIVE ACTION REGISTER - BY AREA</h2>
      <div class="section-line"></div>
    </div>

    ${areaSectionsHtml}

    <!-- Footer -->
    <div class="report-footer">
      <div class="footer-left">
        OCS Group Inspection Division<br>
        www.ocsgroup.com | info@ocsgroup.com
      </div>
      <div class="footer-right">
        Confidential Report<br>
        Page 5+ of ${Math.ceil(inspections.length / 10) + 4}
      </div>
    </div>
  </div>
</body>
</html>`;

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });
    const page = await browser.newPage();

    await page.setDefaultNavigationTimeout(60000);
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=DROPS_Inspection_Report_${Date.now()}.pdf`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);
    res
      .status(500)
      .json({ error: "Failed to generate PDF", details: err.message });
  }
});

export default router;
