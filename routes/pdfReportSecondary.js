import express from "express";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
// import puppeteer from "puppeteer";
const router = express.Router();

/* Escape helper */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function generateInspectionPages(
  inspections,
  hostBase,
  clientName,
  rigName,
  reportTitle,
  reportNumber,
  surveyDate,
  approvedBy,
  revision
) {
  let htmlOut = "";
  let page = 10;
  const perPage = 6;

  // Group inspections by LocationName (Area)
const groupedByArea = inspections.reduce((acc, item) => {
  const area = item.AreaName || "Unknown Area";
  if (!acc[area]) {
    acc[area] = [];
  }
  acc[area].push(item);
  return acc;
}, {});

  // Process each area
  Object.entries(groupedByArea).forEach(([areaName, areaInspections]) => {
    // Paginate within each area
    for (let i = 0; i < areaInspections.length; i += perPage) {
      const chunk = areaInspections.slice(i, i + perPage);

      htmlOut += `
<div class="inspection-page">

  <!-- HEADER -->
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="inspection-header">INSPECTED ITEMS</div>

  <!-- TABLE -->
  <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:9pt;">

    <!-- PROJECT SUBTITLE ROW (MATCHING OCS SAMPLE) -->
    <tr>
      <td colspan="11" style="
        background:#D9E2F3;
        border:1px solid #000;
        padding:8px;
        font-size:9pt;
      ">

        <table style="width:100%; border-collapse:collapse; font-size:9pt;">
          <tr>

            <!-- LEFT SIDE -->
            <td style="width:50%; vertical-align:top;">

              <div><b>Project Number:</b> 
                <span style="text-decoration:underline;">${reportNumber}</span>
              </div>

              <div><b>Client Name:</b> 
                <span style="text-decoration:underline;">${clientName}</span>
              </div>

              <div><b>Location:</b> 
                <span style="text-decoration:underline;">Malaysia, Offshore Terengganu</span>
              </div>

            </td>

            <!-- RIGHT SIDE -->
            <td style="width:50%; vertical-align:top;">

              <div><b>Rig Name:</b> 
                <span style="text-decoration:underline;">${rigName}</span>
              </div>

              <div><b>Inspection Date:</b> 
                <span style="text-decoration:underline;">${surveyDate}</span>
              </div>

              <div><b>Area:</b> 
                <span style="text-decoration:underline; color:red; font-weight:bold;">${escapeHtml(areaName)}</span>
              </div>

            </td>

          </tr>
        </table>

      </td>
    </tr>

    <!-- COLUMN HEADERS -->
    <tr>
      <th style="width:2%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">No.</th>
      <th style="width:15%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Photo</th>
      <th style="width:7%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Photo Ref No.</th>
      <th style="width:9%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Item Description</th>
      <th style="width:7%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Location</th>
      <th style="width:5%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Accessible</th>
      <th style="width:12%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Fastening Method</th>
      <th style="width:7%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Inspection Freq</th>
      <th style="width:13%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">How to Inspect</th>
      <th style="width:8%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Condition</th>
      <th style="width:15%; background:#00009A; color:white; border:1px solid #000; padding:3px; font-size:8pt;">Comments & Recommendations</th>
    </tr>

    <!-- DATA ROWS -->
    ${chunk
      .map((row, idx) => {
        const photo = row.photos?.length
          ? `${hostBase}/api/images/${row.photos[0]}`
          : `${hostBase}/istockphoto-1472933890-612x612.jpg`;

        const condFail = row.Status !== "PASS";
        const condColor = condFail ? "#C00000" : "green";

        return `
      <tr style="height:100px;">

        <!-- NO -->
        <td style="width:2%; border:1px solid #000; padding:2px; text-align:center; vertical-align:middle; font-size:8pt;">
          ${i + idx + 1}
        </td>

        <!-- PHOTO (FIXED SIZE, NO OVERFLOW) -->
        <td style="width:15%; border:1px solid #000; padding:2px; vertical-align:middle; text-align:center;">
          <div style="
            width:100%;
            height:90px;
            overflow:hidden;
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            <img src="${photo}"
              style="
                max-width:100%;
                max-height:90px;
                width:auto;
                height:auto;
                object-fit:contain;
              "
            />
          </div>
        </td>

        <!-- PHOTO REF -->
        <td style="width:7%; border:1px solid #000; padding:2px; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; font-size:7pt; line-height:1.2;">
          ${escapeHtml(row.EquipNumber || "")}
        </td>

        <!-- ITEM DESCRIPTION -->
        <td style="width:9%; border:1px solid #000; padding:2px; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; font-size:7pt; line-height:1.2; max-height:100px; overflow:hidden;">
          ${escapeHtml(row.EquipmentName || "")}
        </td>

        <!-- LOCATION -->
        <td style="width:7%; border:1px solid #000; padding:2px; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; font-size:7pt; line-height:1.2;">
          ${escapeHtml(row.LocationName || "")}
        </td>

        <!-- ACCESSIBLE -->
        <td style="width:5%; border:1px solid #000; padding:2px; text-align:center; vertical-align:middle; font-size:7pt;">
          Yes
        </td>

        <!-- FASTENING -->
        <td style="width:12%; border:1px solid #000; padding:2px; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; font-size:7pt; line-height:1.2; max-height:100px; overflow:hidden;">
          <b>Primary:</b> ${escapeHtml(row.FasteningMethod || "None")}<br/>
          <b>Secondary:</b> ${escapeHtml(row.SecFastMethod || "None")}
        </td>

        <!-- FREQUENCY -->
        <td style="width:7%; border:1px solid #000; padding:2px; text-align:center; vertical-align:middle; font-size:7pt; word-wrap:break-word;">
          ${escapeHtml(row.Control || "7 Days")}
        </td>

        <!-- HOW TO INSPECT -->
        <td style="width:13%; border:1px solid #000; padding:2px; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; font-size:7pt; line-height:1.2; max-height:100px; overflow:hidden;">
          ${escapeHtml(row.PrimaryComments || "")}
        </td>

        <!-- CONDITION -->
        <td style="width:8%; border:1px solid #000; padding:2px; text-align:center; font-weight:bold; color:${condColor}; vertical-align:middle; font-size:8pt;">
          ${escapeHtml(row.Status || "")}
        </td>

        <!-- COMMENTS -->
        <td style="width:15%; border:1px solid #000; padding:2px; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; font-size:7pt; line-height:1.2; max-height:100px; overflow:hidden;">
          ${
            row.SecondaryComments
              ? `> ${escapeHtml(row.SecondaryComments)}<br/>`
              : ""
          }
          ${
            row.Comments
              ? `<b>RECOMMENDATION</b><br/>${escapeHtml(row.Comments)}`
              : ""
          }
        </td>

      </tr>
      `;
      })
      .join("")}

  </table>

  <!-- FOOTER -->
  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(reportTitle)} |
    Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(reportNumber)} | Revision: ${revision}<br/>
    © 2020 OCS Group │ All Rights Reserved | Page ${page}
  </div>

</div>
      `;

      page++;
    }
  });

  return htmlOut;
}


router.post("/reports/pdfSecondary", async (req, res) => {
  try {
    const inspections = Array.isArray(req.body.inspections)
      ? req.body.inspections
      : [];

    const hostBase =
      req.body.hostBase || `http://localhost:${process.env.PORT || 5000}`;

    // Imported or default values
    const clientName = inspections[0]?.ClientName || "UZMA ENGINEERING SDN BHD";
    const assetName = inspections[0]?.AssetName || "HYDRAULIC WORKOVER RIG";
    const rigName = inspections[0]?.RigName || "JENSAK 342";
    const preparedBy = inspections[0]?.InspectorName || "Jumari Bin Hamzah";
    const reportTitle = "Dropped Object Inspection Report";
    const reportNumber = "OCS-S2019-154-01";
    const surveyDate = "13th – 25th January 2020";
    const approveDate = "3rd February";
    const qualityReview = "Mark Tranfield";
    const approvedBy = "Mark Tranfield";
    const revision = "0";

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>DROPS Report</title>

<style>
/* Page setup */
@page {
  size: A4;
  margin: 0;
}

body {
  font-family: Calibri, Arial, sans-serif;
  margin: 0;
  padding: 0;
  font-size: 11pt;
  position: relative;
}

/* ------------------ PAGE 1 ONLY ------------------ */
.page1 {
  position: relative;
  width: 210mm;
  height: 297mm;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.orange-bar {
  position: absolute;
  left: 0;
  top: 0;
  width: 25mm;
  height: 100%;
  background: #e6732d;
  z-index: 1;
}

.page1-content {
  position: relative;
  z-index: 2;
  padding-left: 30mm;
  padding-right: 15mm;
  padding-top: 15mm;
  text-align: center;
  height: 100%;
  box-sizing: border-box;
}

.ocs-logo {
  width: 260px;
  margin-top: 8mm;
  margin-bottom: 10mm;
}

.main-title {
  font-size: 20pt;
  font-weight: bold;
  margin-bottom: 6px;
}

.rig-title {
  font-size: 18pt;
  font-weight: bold;
  margin-bottom: 10px;
}

.sub-title {
  font-size: 14pt;
  font-weight: bold;
  margin-bottom: 15px;
}

.title-image {
  width: 380px;
  border: 2px solid black;
  display: block;
  margin: 10mm auto 8mm auto;
}

.client-title {
  font-size: 15pt;
  font-weight: bold;
  margin-top: 6mm;
  margin-bottom: 6mm;
}

.cover-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin-top: 8mm;
}

.cover-table th, .cover-table td {
  border: 1px solid black;
  padding: 5px;
  text-align: center;
}

/* ------------------ GLOBAL HEADER FOR PAGE 2+ ------------------ */
.page {
  page-break-before: always;
  position: relative;
  min-height: 297mm;
  padding: 15mm;
  box-sizing: border-box;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4mm; /* Reduced from 8mm */
}

.header-logo {
  width: 140px;
}

.header-text {
  text-align: right;
  font-size: 10pt;
  font-weight: bold;
  line-height: 1.3;
}

/* ------------------ PAGE 2 CONTENT ------------------ */
.section-title {
  text-align: center;
  font-size: 13pt;
  font-weight: bold;
  margin: 8mm 0 4mm 0; /* Reduced margins */
}

.info-table, .revision-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin-bottom: 6mm; /* Reduced from 10mm */
}

.info-table th, .info-table td,
.revision-table th, .revision-table td {
  border: 1px solid black;
  padding: 6px;
}

.info-table th {
  width: 38%;
  text-align: left;
  background: #f2f2f2;
}

.revision-table th {
  background: #f2f2f2;
  text-align: center;
}

/* ------------------ PAGE 3 - MISSION STATEMENT ------------------ */
.mission-box {
  border: 2px solid #e6732d;
  padding: 15px;
  margin: 10mm 0; /* Reduced from 15mm */
  text-align: center;
}

.mission-title {
  font-size: 14pt;
  font-weight: bold;
  color: #e6732d;
  margin-bottom: 10px;
}

.mission-text {
  font-size: 10pt;
  line-height: 1.6;
  margin-bottom: 10px;
}

.mission-quote {
  font-size: 11pt;
  font-weight: bold;
  font-style: italic;
  margin-top: 15px;
}

.disclaimer-title {
  font-size: 12pt;
  font-weight: bold;
  margin-top: 10mm; /* Reduced from 15mm */
  margin-bottom: 8px;
}

.disclaimer-text {
  font-size: 9pt;
  line-height: 1.5;
  text-align: justify;
}

.disclaimer-text ul {
  margin: 8px 0;
  padding-left: 20px;
}

.disclaimer-text li {
  margin-bottom: 5px;
}

/* ------------------ PAGE 4 - TABLE OF CONTENTS ------------------ */
.toc-title {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  margin: 10mm 0 6mm 0; /* Reduced margins */
  text-transform: uppercase;
}

.toc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11pt;
}

.toc-table td {
  padding: 8px;
  border-bottom: 1px solid #ddd;
}

.toc-table td:first-child {
  font-weight: bold;
  width: 85%;
}

.toc-table td:last-child {
  text-align: right;
  width: 15%;
}

/* ------------------ PAGE 5 - SURVEY WORKSCOPE ------------------ */
.workscope-content {
  font-size: 10pt;
  line-height: 1.6;
  text-align: justify;
}

.workscope-content p {
  margin-bottom: 10px;
}

/* ------------------ PAGE 7 - REPORT SUMMARY ------------------ */
.summary-content {
  font-size: 10pt;
  line-height: 1.6;
  text-align: justify;
}

.summary-content p {
  margin-bottom: 10px;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin: 15px 0;
}

.summary-table th, .summary-table td {
  border: 1px solid black;
  padding: 6px;
  text-align: center;
}

.summary-table th {
  background: #f2f2f2;
  font-weight: bold;
}

.summary-table td:nth-child(2) {
  text-align: left;
}

/* ------------------ GLOBAL FOOTER FOR PAGE 2+ ------------------ */
.footer {
  position: absolute;
  bottom: 15mm;
  left: 15mm;
  right: 15mm;
  font-size: 8pt;
  text-align: center;
  border-top: 1px solid #aaa;
  padding-top: 4px;
  line-height: 1.3;
}

.page-number::before {
  content: "Page " counter(page);
}

/* ------------------ INSPECTION PAGES OPTIMIZATION ------------------ */
.inspection-page {
  page-break-before: always;
  position: relative;
  min-height: 297mm;
  padding: 10mm 12mm 15mm 12mm;
  box-sizing: border-box;
}

.inspection-header {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  margin-bottom: 4mm; /* Reduced from 6mm */
}

/* OCS DROPPED OBJECT TABLE */
.ocs-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 5px;
  table-layout: fixed;        /* SUPER IMPORTANT — evenly locks widths */
}
  .ocs-table td {
  border: 1px solid #000;
  font-size: 9pt;
  padding: 4px;
  vertical-align: top;
}


.ocs-th-blue {
  background: #1f4e79;
  color: white;
  font-weight: bold;
  text-align: center;
  padding: 4px;
  border: 1px solid #000;
}

.ocs-td {
  border: 1px solid #000;
  padding: 4px;
}

.ocs-photo {
  width: 140px;
  height: 110px;
  object-fit: cover;
  border: 1px solid #000;
}

.ocs-condition-pass {
  color: green;
  font-weight: bold;
}

.ocs-condition-fail {
  color: #C00000;
  font-weight: bold;
}

.ocs-recommend {
  color: #C00000;
  font-weight: bold;
}

.ocs-sub-blue {
  background: #d9e2f3;
  font-weight: bold;
  border: 1px solid #000;
}

/* FIXED column widths EXACT to OCS sample */
.row-table td, .blue-header th {
  border: 1px solid #000;
  padding: 3px;
  vertical-align: top;
}

.blue-title {
  background: #1F4E79;
  color: #fff;
  font-weight: bold;
  padding: 6px;
  text-align: center;
  border: 1px solid #000;
  font-size: 11px;
}

.blue-sub {
  background: #D9E2F3;
  border: 1px solid #000;
  padding: 5px;
  font-weight: bold;
  font-size: 10px;
}


.blue-header th {
  background: #1F4E79;
  color: #fff;
  font-weight: bold;
  text-align: center;
  font-size: 9pt;
  padding: 4px;
  border: 1px solid #000;
}


/* EXACT column sizes */
.col-no        { width: 22px;  text-align:center; }
.col-photo {
  width: 140px;
  text-align: center;
  overflow: hidden;        /* prevents escaping */
  box-sizing: border-box;
}
.col-comments,
.col-inspect,
.col-fastening {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;   /* allow wrapping */
}

.col-ref       { width: 70px;  text-align:center; }
.col-desc      { width: 90px; }
.col-location  { width: 75px; }
.col-access    { width: 50px;  text-align:center; }
.col-fastening { width: 110px; }
.col-frequency { width: 55px;  text-align:center; }
.col-inspect   { width: 150px; }
.col-condition { width: 70px;  text-align:center; font-weight:bold; }
.col-comments  { width: 210px; }

/* Photo box EXACT size */
.photo-box {
  width: 100%;
  height: 110px;
  object-fit: cover;
  display: block;
  overflow: hidden;
}



/* Condition colors */
.fail-text { color: #C00000; font-weight:bold; }
.pass-text { color: green; font-weight:bold; }

/* Compact row styling */
.compact-row {
  margin: 0;
  padding: 0;
}

.compact-row td {
  padding: 2px 3px;
  line-height: 1.2;
}
  /* A3 Landscape for Inspection Pages Only */
@page a3 {
  size: A3 landscape;
  margin: 10mm;
}

.a3-page {
  page: a3;
}


</style>
</head>

<body>

<!-- ========== PAGE 1 - COVER PAGE ========== -->
<div class="page1">
  <div class="orange-bar"></div>
  <div class="page1-content">
    <img src="${hostBase}/ocslogo.png" class="ocs-logo" />
    <div class="main-title">${escapeHtml(assetName)}</div>
    <div class="rig-title">${escapeHtml(rigName)}</div>
    <div class="sub-title">${escapeHtml(reportTitle)}</div>
    <img src="${hostBase}/drop-stack-title-image.png" class="title-image" />
    <div class="client-title">CLIENT: ${escapeHtml(clientName)}</div>

    <table class="cover-table">
      <tr>
        <th>Revision</th>
        <th>Approve Date</th>
        <th>Prepared By</th>
        <th>Quality Review</th>
        <th>Approve by</th>
      </tr>
      <tr>
        <td>${revision}</td>
        <td>${approveDate}</td>
        <td>${escapeHtml(preparedBy)}</td>
        <td>${escapeHtml(qualityReview)}</td>
        <td>${escapeHtml(approvedBy)}</td>
      </tr>
    </table>
  </div>
</div>

<!-- ========== PAGE 2 - REPORT INFORMATION ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="section-title">Report Information</div>

  <table class="info-table">
    <tr><th>Client:</th><td>${escapeHtml(clientName)}</td></tr>
    <tr><th>Report Title:</th><td>${escapeHtml(reportTitle)}</td></tr>
    <tr><th>Report Number:</th><td>${escapeHtml(reportNumber)}</td></tr>
    <tr><th>Rig / Project Name:</th><td>${escapeHtml(rigName)}</td></tr>
    <tr><th>Inspected By:</th><td>${escapeHtml(
      preparedBy
    ).toUpperCase()}</td></tr>
    <tr><th>Survey Date:</th><td>${escapeHtml(surveyDate)}</td></tr>
  </table>

  <div class="section-title">Report Revision History</div>

  <table class="revision-table">
    <tr>
      <th>Rev</th>
      <th>Date</th>
      <th>Prepare by</th>
      <th>QA Review</th>
      <th>Brief Change Description</th>
    </tr>
    <tr>
      <td>0</td>
      <td>28 Jan 20</td>
      <td>Axel Tay</td>
      <td>Mark Tranfield</td>
      <td>Final Report</td>
    </tr>
    <tr>
      <td>A</td>
      <td>28 Jan 20</td>
      <td>Jumari Bin Hamzah</td>
      <td>-</td>
      <td>Draft Report</td>
    </tr>
  </table>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 2 of 10
  </div>
</div>

<!-- ========== PAGE 3 - MISSION STATEMENT ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="mission-box">
    <div class="mission-title">MISSION STATEMENT</div>
    <div class="mission-text">
      OCS Group is dedicated to become the world's premier provider in<br/>
      Commissioning, Audits, Inspections and Technical Training within the oil,<br/>
      gas and energy industry.
    </div>
    <div class="mission-text">
      Our mission will be achieved through innovation to improve our service<br/>
      quality and customer satisfaction in a cost effective manner with the highest<br/>
      regard to safety and the environment.
    </div>
    <div class="mission-quote">
      "Excellence" is where we start; "Perfection" is our aim.
    </div>
  </div>

  <div class="disclaimer-title">Disclaimer:</div>
  <div class="disclaimer-text">
    <p>This report, prepared by Offshore Commissioning Solutions (OCS) is confidential. It has been prepared on behalf of the client mentioned on the cover page ("the client") and is issued pursuant to an agreement between OCS and the client. It has been produced according to the scope of work and is only suitable for use in connection therewith.</p>
    
    <p>All measures and decisions based on this analysis and these findings are the sole responsibility of the client. OCS does not accept:</p>
    
    <ul>
      <li>Any liability for the identification, indication or elimination of dangers and non-compliances (in the broadest sense of the word), nor for any damage caused by any of these;</li>
      <li>Any obligation to report all facts or circumstances established during the visit. This obligation comes completely under the authority and responsibility of the client;</li>
      <li>Any liability for the client's obligations resulting from (legal) rules and/or statutes;</li>
      <li>Any liability or responsibility whatsoever in respect of or reliance upon this report by any third party.</li>
    </ul>
    
    <p>The execution of improvements recommended by OCS does not indemnify the client against any legal or contractual obligations and offers no safeguard against the elimination of dangers or damages resulting from the client's products, services, company assets, etcetera.</p>
    
    <p>No part of this publication may be reproduced, stored in a retrieval system or transmitted in any form or by any means, electronic, mechanical, photocopying, recording, or otherwise without prior permission, in writing, of OCS, except for restricted use within the client's organization.</p>
  </div>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 3 of 10
  </div>
</div>

<!-- ========== PAGE 4 - TABLE OF CONTENTS ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="toc-title">DROPPED OBJECT INSPECTION REPORT CONTENT PAGE</div>

  <table class="toc-table">
    <tr>
      <td>A. SURVEY WORKSCOPE</td>
      <td>6</td>
    </tr>
    <tr>
      <td>B. REPORT SUMMARY</td>
      <td>8</td>
    </tr>
    <tr>
      <td>C. APPENDIX A: DROPPED OBJECT INSPECTION RESULT</td>
      <td>9</td>
    </tr>
  </table>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 4 of 10
  </div>
</div>

<!-- ========== PAGE 5 - SURVEY WORKSCOPE DIVIDER ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="section-title" style="margin-top: 80mm;">SURVEY WORKSCOPE</div>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 5 of 10
  </div>
</div>

<!-- ========== PAGE 6 - SURVEY WORKSCOPE CONTENT ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="section-title">A. SURVEY WORKSCOPE</div>

  <div class="workscope-content">
    <p>OCS survey team attended the hydraulic workover unit JENSAK 342 onboard Platform Unit PULAI-ALPHA to conduct dropped object inspection onboard whilst she was offshore in Malaysia, Kuantan.</p>
    
    <p>The dropped objection inspection will be inspection on the potential dropped objects and any unauthorized or approved modification to the structure.</p>
    
    <p>A full register with photograph reference are to be developed stating position, method of fastening and control of frequency. Comments and recommendation will be given for unsatisfactory securing methods.</p>
  </div>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 6 of 10
  </div>
</div>

<!-- ========== PAGE 7 - REPORT SUMMARY DIVIDER ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="section-title" style="margin-top: 80mm;">REPORT SUMMARY</div>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 7 of 10
  </div>
</div>

<!-- ========== PAGE 8 - REPORT SUMMARY CONTENT ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div class="section-title">B. REPORT SUMMARY</div>

  <div class="summary-content">
    <p>On behalf of UZMA ENGINEERING SDN BHD, the OCS inspector attended JENSAK 342, between 13<sup>th</sup> – 25<sup>th</sup> January 2020.</p>
    
    <p>The objective of this Inspection is to conduct a dropped objection inspection. The inspection was carried out in accordance to DROPS guidelines (Dropped Object Prevention Scheme Recommended Practice Revision 3 and 4). The aim and objective of this survey is to minimize and eliminate the potential hazards of dropped objects. Location drawings were also included for each area inspected to allow ease of identifying and locating the defective item.</p>
    
    <p>Daily report and unsatisfactory item list were submitted to the Offshore Installation Manager (Jantom Anak Nyami) at the end of each shift for inspection update and action required. A compiled of draft copy of the unsatisfactory item list was submitted to the Offshore Installation Manager upon the end of the inspection.</p>
    
    <p>A total of 166 items were inspected throughout the rig with 39 satisfactory and 127 recommended for corrective actions. A breakdown is detailed below:</p>

    <table class="summary-table">
      <tr>
        <th>Area No.</th>
        <th>Area Description</th>
        <th>Inspected Items</th>
        <th>Satisfactory</th>
        <th>Unsatisfactory</th>
      </tr>
      <tr>
        <td>1.</td>
        <td>Active Pit Sand Trap & Mud Tanks</td>
        <td>19</td>
        <td>0</td>
        <td>19</td>
      </tr>
      <tr>
        <td>2.</td>
        <td>Hydraulic Workover Unit</td>
        <td>72</td>
        <td>10</td>
        <td>62</td>
      </tr>
      <tr>
        <td>3.</td>
        <td>Main Deck- Base Mixer Skid</td>
        <td>15</td>
        <td>8</td>
        <td>7</td>
      </tr>
      <tr>
        <td>4.</td>
        <td>Main Deck- Crane Handal</td>
        <td>56</td>
        <td>21</td>
        <td>35</td>
      </tr>
      <tr>
        <td>5.</td>
        <td>Main Deck-Koomey Unit Skid</td>
        <td>4</td>
        <td>0</td>
        <td>4</td>
      </tr>
    </table>

    <p>The securing devices are recommended to be designed in accordance to the equipment supplier's calculations to withstand the shock load of the item in an event of a fall, therefore a safety sling and 4 piece (bolt & nut type) shackles with Safe Working Load and ID number is a way to ensure manufacturer's recommendations are being met.</p>
    
    <p>Whilst all efforts have been given to address all potential DROPPED OBJECTS, a well planned maintenance programmed, procedures and regular inspection is the prime tool to counter dropped objects. Stringent maintenance routines and active participation in UCUA card programmed by all personnel will ensure a hazard free and safe work place.</p>
    
    <p>The above findings were documented together with digital photographs and respective level of corrective actions and recommendations / suggestions contained in this report.</p>
    
    <p>OCS would like to express our gratitude to the crew and management for their cooperation and assistance during our survey.</p>
    
    <p style="margin-top: 15px;"><strong>OCS Survey Team</strong><br/>January 2020</p>
  </div>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(
      reportTitle
    )} | Revised By: Axel Tay | Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(
      reportNumber
    )} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 8 of 10
  </div>
</div>
<!-- ========== PAGE 9 - APPENDIX A TITLE ========== -->
<div class="page">
  <div class="header-container">
    <img src="${hostBase}/ocslogo.png" class="header-logo" />
    <div class="header-text">
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(rigName)}<br/>
      ${escapeHtml(reportTitle)}
    </div>
  </div>

  <div style="margin-top: 90mm; text-align:center; font-size:14pt; font-weight:bold;">
    C.&nbsp;&nbsp;&nbsp; APPENDIX A: DROPPED OBJECT INSPECTION RESULT
  </div>

  <div class="footer">
    Doc Title: ${escapeHtml(rigName)} ${escapeHtml(reportTitle)} | Revised By: Axel Tay |
    Approved By: ${escapeHtml(approvedBy)}<br/>
    Doc Number: ${escapeHtml(reportNumber)} | Revision: ${revision} | Approval Date: ${approveDate} 2020<br/>
    © 2020 OCS Group │All Rights Reserved | Page 9
  </div>
</div>

${generateInspectionPages(
  inspections,
  hostBase,
  clientName,
  rigName,
  reportTitle,
  reportNumber,
  surveyDate,
  approvedBy,
  revision
)}


</body>
</html>
`;

    // const browser = await puppeteer.launch({
    //   headless: true,
    //   args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // });
    // Puppeteer Launch
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=OCS_Report_${Date.now()}.pdf`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF Generation Error:", err);
    res
      .status(500)
      .json({ error: "Failed to generate PDF", details: err.message });
  }
});

export default router;