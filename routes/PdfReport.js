import express from "express";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { ChartJSNodeCanvas } from "chartjs-node-canvas"; // chart rendering

const router = express.Router();

// Escape HTML helper — keep same
function escapeText(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------
// 🟦 GRAPH GENERATOR FUNCTION (returns image as BASE64 PNG)
// ---------------------------------------------------------
async function generateAreaSummaryChart(inspections) {
  const width = 1400; // big chart for clarity
  const height = 550;

  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  // Group by AreaName + count RiskName types
  const areaStats = {};

  inspections.forEach((item) => {
    const area = item.AreaName || "UNSPECIFIED";
    const risk = (item.RiskName || "UNSPECIFIED").toUpperCase();

    if (!areaStats[area]) {
      areaStats[area] = { CRITICAL: 0, MAJOR: 0, MINOR: 0, OBSERVATION: 0 };
    }
    if (["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"].includes(risk)) {
      areaStats[area][risk]++;
    }
  });

  const labels = Object.keys(areaStats);

  // datasets follow sample color layout (stacked)
  const datasets = [
    {
      label: "Observation",
      data: labels.map((area) => areaStats[area].OBSERVATION),
      backgroundColor: "#00A651",
    },
    {
      label: "Minor",
      data: labels.map((area) => areaStats[area].MINOR),
      backgroundColor: "#1E64C8",
    },
    {
      label: "Major",
      data: labels.map((area) => areaStats[area].MAJOR),
      backgroundColor: "#F4A259",
    },
    {
      label: "Critical",
      data: labels.map((area) => areaStats[area].CRITICAL),
      backgroundColor: "#E10600",
    },
  ];

  const configuration = {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" },
        title: {
          display: true,
          text: "Area Based Dropped Object Overall Summary",
          font: { size: 20, weight: "bold" },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { maxRotation: 75, minRotation: 45 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  };

  const imgBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${imgBuffer.toString("base64")}`;
}

async function generateCorrectiveActionChart(inspections) {
  const correctiveItems = inspections.filter(
    (item) =>
      item.Status !== "PASS" &&
      ["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"].includes(
        item.RiskName?.toUpperCase()
      )
  );

  const areaCounts = {};

  correctiveItems.forEach((item) => {
    const area = item.AreaName?.trim() || "UNSPECIFIED";
    const risk = item.RiskName?.toUpperCase();

    if (!areaCounts[area]) {
      areaCounts[area] = { OBSERVATION: 0, MINOR: 0, MAJOR: 0, CRITICAL: 0 };
    }

    areaCounts[area][risk] += 1;
  });

  const labels = Object.keys(areaCounts);
  const dataObservation = labels.map((a) => areaCounts[a].OBSERVATION);
  const dataMinor = labels.map((a) => areaCounts[a].MINOR);
  const dataMajor = labels.map((a) => areaCounts[a].MAJOR);
  const dataCritical = labels.map((a) => areaCounts[a].CRITICAL);

  const width = 1800;
  const height = 700;
  const chartCallback = (ChartJS) => {
    ChartJS.defaults.font.family = "Calibri";
    ChartJS.defaults.font.size = 16;
  };

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    chartCallback,
  });

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Observation",
          data: dataObservation,
          backgroundColor: "green",
        },
        {
          label: "Minor",
          data: dataMinor,
          backgroundColor: "blue",
        },
        {
          label: "Major",
          data: dataMajor,
          backgroundColor: "orange",
        },
        {
          label: "Critical",
          data: dataCritical,
          backgroundColor: "red",
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { position: "right" },
        title: {
          display: true,
          text: "Area Based Corrective Action Register Overall Summary",
          color: "#000",
          font: { size: 26, weight: "bold" },
        },
        datalabels: {
          display: true,
          color: "white",
          font: { weight: "bold", size: 18 },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { maxRotation: 50, minRotation: 50 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          max:
            Math.max(
              ...dataObservation,
              ...dataMinor,
              ...dataMajor,
              ...dataCritical,
              1
            ) + 1,
        },
      },
    },
  };

  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  return buffer.toString("base64");
}
async function generateLocationSummaryChart(inspections) {
  const width = 1800;
  const height = 700;

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    chartCallback: (ChartJS) => {
      ChartJS.defaults.font.family = "Calibri";
      ChartJS.defaults.font.size = 14;
    },
  });

  // Build location stats
  const locationStats = {};

  inspections.forEach((item) => {
    const location = item.LocationName?.trim() || "UNSPECIFIED";
    const risk = (item.RiskName || "UNSPECIFIED").toUpperCase();

    if (!locationStats[location]) {
      locationStats[location] = {
        OBSERVATION: 0,
        MINOR: 0,
        MAJOR: 0,
        CRITICAL: 0,
      };
    }

    if (["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"].includes(risk)) {
      locationStats[location][risk]++;
    }
  });

  const labels = Object.keys(locationStats);
  const dataObservation = labels.map((l) => locationStats[l].OBSERVATION);
  const dataMinor = labels.map((l) => locationStats[l].MINOR);
  const dataMajor = labels.map((l) => locationStats[l].MAJOR);
  const dataCritical = labels.map((l) => locationStats[l].CRITICAL);

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Observation",
          data: dataObservation,
          backgroundColor: "#00A651",
        },
        { label: "Minor", data: dataMinor, backgroundColor: "#1E64C8" },
        { label: "Major", data: dataMajor, backgroundColor: "#F4A259" },
        { label: "Critical", data: dataCritical, backgroundColor: "#E10600" },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { position: "right" },
        title: {
          display: true,
          text: "Location Based Dropped Object Overall Summary",
          color: "#000",
          font: { size: 26, weight: "bold" },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { maxRotation: 55, minRotation: 55 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          max:
            Math.max(
              ...dataObservation,
              ...dataMinor,
              ...dataMajor,
              ...dataCritical,
              1
            ) + 1,
        },
      },
    },
  };

  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  return buffer.toString("base64");
}

async function generateLocationCorrectiveActionChart(inspections) {
  // Filter only corrective actions (exclude PASS)
  const correctiveList = inspections.filter(
    (item) =>
      item.Status?.toUpperCase() !== "PASS" &&
      ["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"].includes(
        item.RiskName?.toUpperCase()
      )
  );

  const locationCounts = {};

  correctiveList.forEach((item) => {
    const loc = item.LocationName?.trim() || "UNSPECIFIED";
    const risk = item.RiskName?.toUpperCase();

    if (!locationCounts[loc]) {
      locationCounts[loc] = { OBSERVATION: 0, MINOR: 0, MAJOR: 0, CRITICAL: 0 };
    }

    locationCounts[loc][risk] += 1;
  });

  const labels = Object.keys(locationCounts);
  const dataObs = labels.map((l) => locationCounts[l].OBSERVATION);
  const dataMinor = labels.map((l) => locationCounts[l].MINOR);
  const dataMajor = labels.map((l) => locationCounts[l].MAJOR);
  const dataCritical = labels.map((l) => locationCounts[l].CRITICAL);

  const width = 1800,
    height = 700;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    chartCallback: (ChartJS) => {
      ChartJS.defaults.font.family = "Calibri";
      ChartJS.defaults.font.size = 16;
    },
  });

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Observation", backgroundColor: "#00A651", data: dataObs },
        { label: "Minor", backgroundColor: "#1E64C8", data: dataMinor },
        { label: "Major", backgroundColor: "#F4A259", data: dataMajor },
        { label: "Critical", backgroundColor: "#E10600", data: dataCritical },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { position: "right" },
        title: {
          display: true,
          text: "Location Based Corrective Action Register Overall Summary",
          font: { size: 24, weight: "bold" },
          color: "#000",
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { minRotation: 50, maxRotation: 50 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          max:
            Math.max(
              ...dataObs,
              ...dataMinor,
              ...dataMajor,
              ...dataCritical,
              1
            ) + 1,
        },
      },
    },
  };

  const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  return buffer.toString("base64");
}

// Add this function to generate inspection pages by area
// Add this function to generate inspection tables by area with multiple rows per page
// Add this function to generate inspection tables by area with multiple rows per page
// Add this function to generate inspection tables by area with your exact table style
// Add this function to generate inspection tables by area with multiple inspections per page
// Add this function to generate inspection tables by area with multiple inspections per page
// Add this function to generate inspection tables by area with multiple inspections per page
function generateInspectionTablesByArea(
  inspections,
  hostBase,
  projectName,
  inspectorName,
  inspectionMonthYear
) {
  let html = "";
  let pageNumber = 14;

  const inspectionsByArea = {};
  inspections.forEach((inspection) => {
    const area = inspection.AreaName || "UNSPECIFIED";
    if (!inspectionsByArea[area]) inspectionsByArea[area] = [];
    inspectionsByArea[area].push(inspection);
  });

  Object.keys(inspectionsByArea).forEach((areaName) => {
    const areaInspections = inspectionsByArea[areaName];

    html += `
<div class="page-break"></div>
<div class="page content-page">
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <div class="page-content" style="position:relative; display:flex; justify-content:center; align-items:center;">
    <img src="${hostBase}/ocslogo.png"
      style="position:absolute; width:60%; opacity:0.13; filter:blur(0.5px);" />
    <div style="font-size:16pt; font-weight:bold; z-index:10;">
      ${areaName.toUpperCase()}
    </div>
  </div>

  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>${pageNumber}</td>
    </tr>
  </table>
</div>`;
    pageNumber++;

    const batchSize = 2;
    for (let i = 0; i < areaInspections.length; i += batchSize) {
      const batch = areaInspections.slice(i, i + batchSize);

      html += `
<div class="page-break"></div>
<div class="page content-page">
  <div class="header-row" style="display:flex; justify-content:space-between;">
    <img src="${hostBase}/ocslogo.png" class="header-logo" style="height:35px;" />
    <img src="${hostBase}/abclogo.png" class="header-logo" style="height:35px;" />
  </div>

  <div class="page-content" style="margin-top:8px;">`;

      batch.forEach((inspection, index) => {
        const risk = (inspection.RiskName || "").toUpperCase();
        const riskColor =
          risk === "CRITICAL"
            ? "#E10600"
            : risk === "MAJOR"
            ? "#F4A259"
            : risk === "MINOR"
            ? "#1E64C8"
            : risk === "OBSERVATION"
            ? "#00A651"
            : "#5B9BD5";

        const statusColor = inspection.Status === "PASS" ? "green" : "#C00000";

        const photos = inspection.photos && inspection.photos.length > 0;
        const photoUrl = photos
          ? `${hostBase}/api/images/${inspection.photos[0]}`
          : null;

        // Dynamically adjust colspans based on photo presence
        const imageColumn = photos
          ? `<td rowspan="3" style="border:1px solid #000; width:130px; padding:0;">
               <img src="${photoUrl}" style="width:100%; height:160px; object-fit:cover;" />
             </td>`
          : "";

        const colspanPrimary = photos ? 2 : 3;
        const colspanSec = photos ? 2 : 3;
        const colspanComments = photos ? 4 : 5;
        const colspanObservation = photos ? 3 : 4;

        html += `
<table style="width:100%; border-collapse:collapse; font-size:8.5pt; border:1.5px solid #000; margin-bottom:${
          index < batch.length - 1 ? "15px" : "0"
        };">
  <tr>
    <td style="border:1px solid #000; font-weight:bold;">Equipment No</td>
    <td style="border:1px solid #000; font-weight:bold;">Area Name</td>
    <td style="border:1px solid #000; font-weight:bold;">Location Name</td>
    <td style="border:1px solid #000; font-weight:bold;">Equipment</td>
    <td style="border:1px solid #000; font-weight:bold;">Control</td>
    <td style="border:1px solid #000; font-weight:bold;">Risk</td>
    <td style="border:1px solid #000; font-weight:bold;">Env Factor</td>
    <td style="border:1px solid #000; font-weight:bold;">Consequence</td>
    <td style="border:1px solid #000; font-weight:bold;">Serial No</td>
    <td style="border:1px solid #000; font-weight:bold;">Status</td>
    <td style="border:1px solid #000; font-weight:bold;">Repaired</td>
    <td style="border:1px solid #000; font-weight:bold;">Inspector</td>
  </tr>

  <tr>
    <td style="border:1px solid #000;">${inspection.EquipNumber || ""}</td>
    <td style="border:1px solid #000;">${inspection.AreaName || ""}</td>
    <td style="border:1px solid #000;">${inspection.LocationName || ""}</td>
    <td style="border:1px solid #000;">${inspection.EquipmentName || ""}</td>
    <td style="border:1px solid #000;">${inspection.Control || ""}</td>
    <td style="border:1px solid #000; background:${riskColor}; font-weight:bold; color:white;">
      ${inspection.RiskName || ""}
    </td>
    <td style="border:1px solid #000;">${inspection.EnvironFactor || ""}</td>
    <td style="border:1px solid #000;">${inspection.Consequence || ""}</td>
    <td style="border:1px solid #000;">${inspection.SerialNo || ""}</td>
    <td style="border:1px solid #000; color:${statusColor}; font-weight:bold;">${
          inspection.Status || ""
        }</td>
    <td style="border:1px solid #000;">${inspection.CARepairedStatus || ""}</td>
    <td style="border:1px solid #000;">${inspection.InspectorName || ""}</td>
  </tr>

  <tr>
    ${imageColumn}
    <td colspan="${colspanPrimary}" style="border:1px solid #000; font-weight:bold;">Primary Comments</td>
    <td colspan="${colspanSec}" style="border:1px solid #000; font-weight:bold;">Secondary Comments</td>
    <td colspan="${colspanComments}" style="border:1px solid #000; font-weight:bold;">Comments</td>
    <td colspan="${colspanObservation}" style="border:1px solid #000; font-weight:bold;">Observation</td>
  </tr>

  <tr style="height:100px; vertical-align:top;">
    <td colspan="${colspanPrimary}" style="border:1px solid #000; text-align:left; padding:3px;">${
          inspection.PrimaryComments || ""
        }</td>
    <td colspan="${colspanSec}" style="border:1px solid #000; text-align:left; padding:3px;">${
          inspection.SecondaryComments || ""
        }</td>
    <td colspan="${colspanComments}" style="border:1px solid #000; text-align:left; padding:3px;">${
          inspection.Comments || ""
        }</td>
    <td colspan="${colspanObservation}" style="border:1px solid #000; text-align:left; padding:3px;">${
          inspection.Observation || ""
        }</td>
  </tr>
</table>`;
      });

      html += `
  </div>

  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2" style="text-align:right;">www.ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA</b></td><td>Anna</td>
      <td><b>Page</b></td><td>${pageNumber}</td>
    </tr>
  </table>
</div>`;
      pageNumber++;
    }
  });

  return html;
}
// ---------------------------------------------------------
// 🟦 PDF GENERATION — INCLUDING PAGE 10
// ---------------------------------------------------------
router.post("/reports/pdf", async (req, res) => {
  try {
    const inspections = Array.isArray(req.body.inspections)
      ? req.body.inspections
      : [];
    const hostBase =
      req.body.hostBase || `http://localhost:${process.env.PORT || 5000}`;

    if (inspections.length === 0) {
      return res.status(400).json({ error: "No inspections provided" });
    }

    // Extract common dynamic fields
    const first = inspections[0];
    const formattedDate = new Date(first.DateInspected || Date.now())
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");

    const inspectionMonthYear = first?.DateInspected
      ? new Date(first.DateInspected).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        })
      : "July 2015";

    const clientName = escapeText(first?.ClientName || "HAZTECH SOLUTIONS");
    const projectName = escapeText(
      first?.ProjectName || "E12C PROJECT SERIA BRUNEI DARUSSALAM"
    );
    const inspectorName = escapeText(first?.InspectorName || "Steve Watt");

    // 🔵 Generate Chart Image
    // 🔵 Generate Charts
    const chartImage = await generateAreaSummaryChart(inspections);
    const correctiveActionChartBase64 = await generateCorrectiveActionChart(
      inspections
    );
    const locationChartBase64 = await generateLocationSummaryChart(inspections);
    const locationCorrectiveChartBase64 =
      await generateLocationCorrectiveActionChart(inspections);

    // Generate dynamic inspection pages with multiple rows per page
    const inspectionPagesHtml = generateInspectionTablesByArea(
      inspections,
      hostBase,
      projectName,
      inspectorName,
      inspectionMonthYear
    );

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Drops Register</title>

<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }

  body {
    font-family: Calibri, Arial, sans-serif;
    margin: 0;
    padding: 0;
    text-align: center;
    color: #000;
  }

  /* COVER PAGE BASE */
  .page {
    width: 100%;
    min-height: calc(100vh - 30mm);
    padding: 0 12mm;
    display: flex;
    flex-direction: column;
  }

  .cover-page {
    justify-content: center;
    align-items: center;
  }

  .cover-logo img { width: 380px; margin-bottom: 35px; }
  .title { font-size: 32pt; font-weight: bold; margin-bottom: 35px; }
  .date-text { font-size: 16pt; font-weight: 600; margin-bottom: 25px; }

  .client-text, .project-text {
    font-size: 15pt; font-weight: 700; text-transform: uppercase; margin-bottom: 18px;
  }
  .project-text { margin-bottom: 40px; }
  .footer-text { font-size: 10.5pt; font-weight: 700; margin-bottom: 5px; }
  .footer-links { margin-top: 3px; font-size: 11pt; color: #0078c9; font-weight: 600; }

  /* INNER PAGES STRUCTURE */
  .content-page {
    padding: 10mm 12mm;
    flex-direction: column;
    display: flex;
    text-align: center;
    min-height: calc(100vh - 30mm);
  }

  .header-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-logo { height: 55px; object-fit: contain; }

  /* Content area grows vertically and pushes footer */
  .page-content {
    flex: 1;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
  }

  .section-title {
    font-size: 18pt;
    font-weight: bold;
    margin-bottom: 20px;
  }

  .subtext {
    font-size: 10pt;
    margin-bottom: 25px;
  }

  /* Signature table */
  .signature-table {
    width: 70%; max-width: 500px;
    border: 1px solid #000;
    border-collapse: collapse;
    font-size: 10pt;
    margin-bottom: 30px;
  }
  .signature-table td { border: 1px solid #000; padding: 10px; }
  .signature-head { font-weight: bold; background: #fff; }

  .info-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
  }

  /* FOOTER — ALWAYS STAYS AT BOTTOM */
  .footer-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
    font-size: 9pt;
    table-layout: fixed;
  }
  .footer-table td {
    padding: 8px;
    border: 1px solid #000;
  }

  .page-break { page-break-before: always; }

</style>
</head>
<body>

<!-- PAGE 1 — COVER -->
<div class="page cover-page">
  <div class="cover-logo"><img src="${hostBase}/ocslogo.png" /></div>
  <div class="title">Drops Register</div>
  <div class="date-text">${formattedDate}</div>
  <div class="client-text">${clientName}</div>
  <div class="project-text">${projectName}</div>
  <div class="footer-text">Inspection by OCS Group – Inspection Division</div>
  <div class="footer-links">www.ocsgroup.com | info@ocsgroup.com</div>
</div>

<div class="page-break"></div>

<!-- PAGE 2 — QUALITY ASSURANCE -->
<div class="page content-page">
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <div class="page-content">
    <div class="section-title">QUALITY ASSURANCE</div>
    <div class="subtext">The signatures below are to approve this document as accurate...</div>

    <table class="signature-table">
      <tr><td colspan="2" class="signature-head">(3 signatures required)</td></tr>
      <tr><td>PROJECT MANAGEMENT</td><td></td></tr>
      <tr><td>QUALITY ASSURANCE</td><td></td></tr>
      <tr><td>OPERATIONS</td><td></td></tr>
    </table>

    <div class="info-row">
      <div><b>Document Title:</b> Doc 1.0<br><b>Document Number:</b> 1</div>
      <div><b>Revised By:</b> ${inspectorName}<br><b>Revision:</b> Anna</div>
      <div><b>Approved By:</b> Mark Tranfield<br><b>Date:</b> 06-Nov-17</div>
    </div>
  </div>

  <table class="footer-table">
    <tr><td><b>Asset</b></td><td>${projectName}</td><td><b>Inspected By</b></td><td>${inspectorName}</td><td colspan="2">www.ocsgroup.com</td></tr>
    <tr><td><b>Date</b></td><td>${inspectionMonthYear}</td><td><b>QA Review</b></td><td>Anna</td><td><b>Page</b></td><td>2</td></tr>
  </table>
</div>

<div class="page-break"></div>

<!-- PAGE 3 — ACCREDITATIONS -->
<div class="page content-page">
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <div class="page-content">
    <div class="section-title">OCS ACCREDITATIONS</div>

    <div style="display:flex; justify-content:space-around; width:100%;">
      <img src="${hostBase}/IADClogo.png" style="height:90px;" />
      <img src="${hostBase}/houstonlogo.png" style="height:95px;" />
      <img src="${hostBase}/dnv.png" style="height:90px;" />
    </div>
  </div>

  <table class="footer-table">
    <tr><td><b>Asset</b></td><td>${projectName}</td><td><b>Inspected By</b></td><td>${inspectorName}</td><td colspan="2">www.ocsgroup.com</td></tr>
    <tr><td><b>Date</b></td><td>${inspectionMonthYear}</td><td><b>QA Review</b></td><td>Anna</td><td><b>Page</b></td><td>3</td></tr>
  </table>
</div>
<div class="page-break"></div>

<!-- PAGE 4 — TABLE OF CONTENTS -->
<div class="page content-page">
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <div class="page-content">
    <div class="section-title" style="margin-bottom:30px;">TABLE OF CONTENTS</div>

    <table style="width:80%; border-collapse:collapse; font-size:10pt;">
      <tr><td style="width:50px; border:1px solid #000; font-weight:bold;">1</td><td style="border:1px solid #000; font-weight:bold;">DEFINITIONS</td></tr>
      <tr><td style="border:1px solid #000; font-weight:bold;">2</td><td style="border:1px solid #000; font-weight:bold;">INSPECTION SUMMARY</td></tr>
      <tr><td style="border:1px solid #000; font-weight:bold;">3</td><td style="border:1px solid #000; font-weight:bold;">GRAPHS</td></tr>
      <tr><td style="border:1px solid #000; font-weight:bold;">4</td><td style="border:1px solid #000; font-weight:bold;">CORRECTIVE ACTION REGISTER</td></tr>
      <tr><td style="border:1px solid #000;">4.1</td><td style="border:1px solid #000;">CROWN SECTION</td></tr>
      <tr><td style="border:1px solid #000;">4.2</td><td style="border:1px solid #000;">MONKEY BOARD TO CROWN</td></tr>
      <tr><td style="border:1px solid #000;">4.3</td><td style="border:1px solid #000;">PIPE DECKS</td></tr>
      <tr><td style="border:1px solid #000;">4.4</td><td style="border:1px solid #000;">TRAVELING EQUIPMENTS</td></tr>
      <tr><td style="border:1px solid #000; font-weight:bold;">5</td><td style="border:1px solid #000; font-weight:bold;">EQUIPMENT REGISTER</td></tr>
      <tr><td style="border:1px solid #000;">5.1</td><td style="border:1px solid #000;">CROWN SECTION</td></tr>
      <tr><td style="border:1px solid #000;">5.2</td><td style="border:1px solid #000;">CROWN SECTION - (A-FRAME, CROWN PLATFORM, WATER TABLE)</td></tr>
      <tr><td style="border:1px solid #000;">5.3</td><td style="border:1px solid #000;">JACK HOUSES</td></tr>
      <tr><td style="border:1px solid #000;">5.4</td><td style="border:1px solid #000;">LOWER SUBSTRUCTURE AND BOP DECK</td></tr>
      <tr><td style="border:1px solid #000;">5.5</td><td style="border:1px solid #000;">MONKEY BOARD TO CROWN</td></tr>
      <tr><td style="border:1px solid #000;">5.6</td><td style="border:1px solid #000;">PIPE DECKS</td></tr>
      <tr><td style="border:1px solid #000;">5.7</td><td style="border:1px solid #000;">TRAVELING EQUIPMENTS</td></tr>
    </table>
  </div>

  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>4</td>
    </tr>
  </table>
</div>
<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="position:relative; display:flex; justify-content:center; align-items:center;">

      <!-- WATERMARK -->
      <img 
        src="${hostBase}/ocslogo.png"
        style="
          position:absolute;
          width:60%;
          height:auto;
          opacity:0.13;
          filter:blur(0.5px);
          user-select:none;
        "
      />

      <!-- CENTER TITLE -->
      <div style="font-size:16pt; font-weight:bold; z-index:10; letter-spacing:0.5px;">
        DEFINITIONS
      </div>
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>5</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 6 — DROPS AREA EQUIPMENT REGISTER DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- PAGE TITLE -->
  <div class="page-content" style="margin-top:15px;">

    <h2 class="section-title" style="margin-bottom:5px;">
      DROPS AREA EQUIPMENT REGISTER
    </h2>
    <div style="font-size:11pt; font-weight:bold; margin-bottom:18px;">
      DEFINITIONS
    </div>

    <!-- TABLE 1: FAULT CLASSIFICATION -->
    <table style="width:100%; border-collapse:collapse; font-size:10pt; text-align:left; margin-bottom:18px;">
      <tr>
        <td colspan="2" style="border:1px solid #000; font-weight:bold; text-align:center; background:#f7f7f7;">
          FAULT CLASSIFICATION
        </td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:red; width:110px; text-align:center;">CRITICAL</td>
        <td style="border:1px solid #000;">
          A defect identified in Zone 0 that compromises the hazardous area design and integrity of the equipment that if left 
          uncorrected may lead equipment failure, Asset damage, personal injury or death. See example sheet.
        </td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:#e69138; text-align:center;">MAJOR</td>
        <td style="border:1px solid #000;">
          A defect identified in Zone 1 that could compromise the integrity of the equipment, that if left uncorrected may lead 
          to equipment failure, Asset damage, personal injury or death. See example sheet.
        </td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:#3c78d8; text-align:center;">MINOR</td>
        <td style="border:1px solid #000;">
          A defect identified in Zone 2 that compromises the regulatory suitability of the equipment. See example sheet.
        </td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:green; text-align:center;">OBSERVATION</td>
        <td style="border:1px solid #000;">
          A significant detail, not to be considered a defect, but still worthy of notation.
        </td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:#cc7a00; text-align:center;">REPAIRED</td>
        <td style="border:1px solid #000;">
          An identified defect, either Critical, Major or Minor, that has since been repaired by competent personnel and 
          re-inspected, and is no longer considered a defect.
        </td>
      </tr>
    </table>

    <!-- TABLE 2: STATUS -->
    <table style="width:100%; border-collapse:collapse; font-size:10pt; text-align:left; margin-bottom:18px;">
      <tr>
        <td colspan="2" style="border:1px solid #000; font-weight:bold; text-align:center; background:#f7f7f7;">STATUS</td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:green; width:110px; text-align:center;">PASS</td>
        <td style="border:1px solid #000;">
          Equipment found to be in good working order, acceptable for the area installed.
        </td>
      </tr>

      <tr>
        <td style="border:1px solid #000; font-weight:bold; color:red; text-align:center;">FAIL</td>
        <td style="border:1px solid #000;">
          Equipment found to be in poor condition, or unacceptable for the area installed.
        </td>
      </tr>

      <tr style="background:#f2f2f2;">
        <td style="border:1px solid #000; font-weight:bold; color:#666; text-align:center;">NO ACCESS</td>
        <td style="border:1px solid #000;">
          Equipment was unable to be inspected due to lack of access.
        </td>
      </tr>
    </table>

  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>6</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="position:relative; display:flex; justify-content:center; align-items:center;">

      <!-- WATERMARK -->
      <img 
        src="${hostBase}/ocslogo.png"
        style="
          position:absolute;
          width:60%;
          height:auto;
          opacity:0.13;
          filter:blur(0.5px);
          user-select:none;
        "
      />

      <!-- CENTER TITLE -->
      <div style="font-size:16pt; font-weight:bold; z-index:10; letter-spacing:0.5px;">
        SUMMARY
      </div>
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>7</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 9 — SUMMARY -->
<div class="page content-page" style="font-size:9pt; line-height:1.28;">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT -->
  <div class="page-content" style="margin-top:10px; text-align:left;">

    <!-- PAGE TITLE -->
    <h2 class="section-title" style="text-align:center; margin-bottom:18px; font-size:13pt;">
      SUMMARY
    </h2>

    <!-- SUB HEADINGS -->
    <div style="font-weight:bold; font-size:10pt; line-height:1.25; margin-bottom:6px; text-transform:uppercase;">
      ELITE DRILLING SOUTH EAST ASIA SENDIRIAN BERHAD
      <br>DROPS JUNE 2019
      <br>DROPPED OBJECTS PREVENTION SCHEME
    </div>

    <!-- PARAGRAPH BLOCK -->
    <p style="margin-top:4px;">
      <span style="font-weight:bold; color:#004a8f;">OCS Group</span> has been engaged to carry out DROPS SURVEY INSPECTION onboard the 
      E12C LAND RIG belonging to ELITE DRILLING SOUTH EAST ASIA SENDIRIAN BERHAD on behalf of SHELL BRUNEI PETROLEUM BERHAD in SERIA 
      Brunei Darussalam from 21st June 2019 to 28th June 2019. The objective is to inspect all Facilities and Locations for any 
      uncontrolled object that has potential to fall. The DROPPED OBJECTS PREVENTION SCHEME applies to all onshore and offshore locations. 
      The implementation of Restricted Access Areas helps reduce exposure to dropped objects, but is only effective with proper awareness, 
      planning, mitigation and control systems in place.
    </p>

    <!-- SUBTITLE -->
    <div style="margin-top:6px; font-weight:bold; font-size:10pt;">Work Brief</div>

    <p>
      The DROPS SURVEY provides ELITE DRILLING with monitored control measures and maintenance procedure systems for securement and 
      secondary retention. The final report includes INVENTORY LIST, SURVEY ANALYSIS, CORRECTIVE ACTION and DRAWINGS. Close visual 
      inspection using industrial rope access was carried out to safely reach difficult locations. Work was completed on 27th June 2019.
    </p>

    <!-- EXECUTIVE SUMMARY -->
    <div style="margin-top:6px; font-weight:bold; font-size:10pt;">1.2 Executive Summary</div>

    <p>
      OCS Group appreciates the cooperation of ELITE DRILLING SOUTH EAST ASIA SENDIRIAN BERHAD. Overall equipment condition was good with 
      most corrective actions identified as minor. A total of 343 items were inspected, 311 were satisfactory, and 32 required corrective action.
    </p>

    <!-- NUMBERED LIST -->
    <ul style="margin-left:14px; margin-top:4px;">
      <li>Gin Pole / Crown Structures and Equipment</li>
      <li>Upper Mast Section and Equipment (Column 4 & 5)</li>
      <li>Monkey Board Section and Equipment</li>
      <li>Lower Mast Section and Equipment (Column 1 to 3)</li>
      <li>Drill Floor Section</li>
      <li>BOP Section and Equipment</li>
      <li>Mud Pump Section</li>
      <li>Mud Pit Section</li>
      <li>Gamboa Section</li>
      <li>Shale Shaker Section</li>
      <li>Mud Gas Separator Section</li>
      <li>Mud Dispenser Section</li>
      <li>Wire Spool Section</li>
    </ul>

  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>8</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="position:relative; display:flex; justify-content:center; align-items:center;">

      <!-- WATERMARK -->
      <img 
        src="${hostBase}/ocslogo.png"
        style="
          position:absolute;
          width:60%;
          height:auto;
          opacity:0.13;
          filter:blur(0.5px);
          user-select:none;
        "
      />

      <!-- CENTER TITLE -->
      <div style="font-size:16pt; font-weight:bold; z-index:10; letter-spacing:0.5px;">
        INSPECTION ANALYSIS AND TRENDING
      </div>
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>9</td>
    </tr>
  </table>

</div>

<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="position:relative; display:flex; justify-content:center; align-items:center;">

      <!-- WATERMARK -->
  

      <!-- CENTER TITLE -->
      <div style="font-size:16pt; font-weight:bold; z-index:10; letter-spacing:0.5px;">
      <div class="chart-box">
    <img src="${chartImage}" style="width:100%; max-height:75vh; object-fit:contain;"/>
  </div>
      </div>
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>10</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="margin-top:10px; text-align:center;">
    <h2 class="section-title" style="margin-bottom:10px;">
      Area Based Corrective Action Register Overall Summary
    </h2>

    <img src="data:image/png;base64,${correctiveActionChartBase64}"
         style="width:92%; margin:auto; height:auto;" />
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>11</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
 <div class="page-content" style="margin-top:10px; text-align:center;">
    <h2 class="section-title" style="margin-bottom:10px;">
      Location Based Dropped Object Overall Summary
    </h2>

    <img src="data:image/png;base64,${locationChartBase64}" 
         style="width:92%; margin:auto; height:auto;" />
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>12</td>
    </tr>
  </table>

</div>
<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="margin-top:10px; text-align:center;">
    <h2 class="section-title" style="margin-bottom:10px;">
      Location Based Corrective Action Register Overall Summary
    </h2>

    <img src="data:image/png;base64,${locationCorrectiveChartBase64}"
         style="width:92%; margin:auto; height:auto;" />
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>13</td>
    </tr>
  </table>

</div>

<div class="page-break"></div>

<!-- PAGE 5 — DEFINITIONS -->
<div class="page content-page">

  <!-- HEADER -->
  <div class="header-row">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <img src="${hostBase}/abclogo.png" class="header-logo" />
  </div>

  <!-- CONTENT WITH WATERMARK -->
  <div class="page-content" style="position:relative; display:flex; justify-content:center; align-items:center;">

      <!-- WATERMARK -->
      <img 
        src="${hostBase}/ocslogo.png"
        style="
          position:absolute;
          width:60%;
          height:auto;
          opacity:0.13;
          filter:blur(0.5px);
          user-select:none;
        "
      />

      <!-- CENTER TITLE -->
      <div style="font-size:16pt; font-weight:bold; z-index:10; letter-spacing:0.5px;">
        CORRECTIVE ACTION REGISTER
      </div>
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td><b>Asset</b></td><td>${projectName}</td>
      <td><b>Inspected By</b></td><td>${inspectorName}</td>
      <td colspan="2">www.ocsgroup.com | info@ocsgroup.com</td>
    </tr>
    <tr>
      <td><b>Inspection Date</b></td><td>${inspectionMonthYear}</td>
      <td><b>QA Review</b></td><td>Anna</td>
      <td><b>Page</b></td><td>14</td>
    </tr>
  </table>

</div>



${inspectionPagesHtml}
</body>
</html>`;

    // Generate PDF
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=DROPS_Report_${Date.now()}.pdf`
    );
    res.send(pdf);
  } catch (err) {
    res
      .status(500)
      .json({ error: "PDF generation failed", details: err.message });
  }
});

export default router;
