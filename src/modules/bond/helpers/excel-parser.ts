import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

export interface ParsedBondLcRow {
  bankName: string;
  branchName: string;
  adsCode: string;
  lcYear: string;
  lcNature: string;
  lcSerial: string;
  lcId: string;
  lcValue: number;
  currency: string;
  lcDate?: Date;
  lcExpiryDate?: Date;
  bbUsansePeriod: string;
  lastShipDate?: Date;
  proceedsDate?: Date;
  irc: string;
  exporterInfo: string;
  applicantName: string;
  exportLcNumber: string;
  beneficiaryBank: string;
  beneficiaryBranch: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryIrc: string;
  beneficiaryErc: string;
  piNumber: string;
  piDate?: Date;
  bondLicense: string;
  accepted: string;
  cancelYn: string;
  cancelCause: string;
  entryDate?: Date;
  rawData: Record<string, any>;
}

export interface AnalyticalSummary {
  totalRecords: number;
  totalLcValue: number;
  currencyTotals: Record<string, number>;
  totalAccepted: number;
  totalCancelled: number;
  bankBreakdown: Record<string, { count: number; totalValue: number }>;
  natureBreakdown: Record<string, number>;
  bondLicenseBreakdown: Record<string, { count: number; totalValue: number }>;
  topApplicants: Array<{ name: string; count: number; totalValue: number }>;
}

/**
 * Normalizes header strings for flexible, case-insensitive comparison
 */
function normalizeHeader(header: any): string {
  return (header || "")
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseMonth(monStr: string): number {
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  return months[monStr.toLowerCase().slice(0, 3)] || 0;
}

/**
 * Parse date values safely from Excel / CSV cells
 */
function parseExcelDate(val: any): Date | undefined {
  if (val === null || val === undefined || val === "") return undefined;

  // 1. If raw number (Excel date serial number e.g. 45685 for 28-Jan-2025)
  if (typeof val === "number") {
    try {
      if ((XLSX as any)?.SSF?.parse_date_code) {
        const parsed = (XLSX as any).SSF.parse_date_code(val);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
        }
      }
    } catch (_) {}
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    return undefined;
  }

  // 2. If Date instance: extract local calendar parts
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return undefined;
    return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
  }

  const str = String(val).trim();
  if (!str || str === "-" || str === "N/A") return undefined;

  // Match 28-Jan-25 or 28-Jan-2025 or 28/Jan/25 or 28 Jan 2025 or 28-JAN-25
  const monMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/);
  if (monMatch) {
    const d = Number(monMatch[1]);
    const mNum = parseMonth(monMatch[2]);
    let yr = Number(monMatch[3]);
    if (monMatch[3].length === 2) {
      yr = yr > 50 ? 1900 + yr : 2000 + yr;
    }
    if (mNum > 0) {
      return new Date(Date.UTC(yr, mNum - 1, d));
    }
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  }

  // Match DD-MM-YY or DD/MM/YY
  const dmyShort = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})/);
  if (dmyShort) {
    let yr = Number(dmyShort[3]);
    yr = yr > 50 ? 1900 + yr : 2000 + yr;
    return new Date(Date.UTC(yr, Number(dmyShort[2]) - 1, Number(dmyShort[1])));
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  return undefined;
}

/**
 * Parse numeric values safely
 */
function parseNumeric(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Parses Bangladesh Bank CSV / Excel file:
 * - Dynamically scans and finds the actual header row (ignoring logos, merged top banners)
 * - Skips rows that have no BANK_NAME or are summary totals
 */
export async function parseBondExcel(buffer: Buffer | ArrayBuffer): Promise<ParsedBondLcRow[]> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // Read workbook using SheetJS (supports XLSX, XLS, CSV, TSV seamlessly)
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No sheets found in the uploaded file.");
  }

  const worksheet = workbook.Sheets[sheetName];
  // Convert sheet to 2D array of raw values
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("Uploaded file is empty.");
  }

  // 1. Find the real header row by scanning for signature column names
  let headerRowIndex = -1;
  const headerMap: Record<number, string> = {};

  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    let matchCount = 0;
    const tempMap: Record<number, string> = {};

    row.forEach((cellVal, colIdx) => {
      const norm = normalizeHeader(cellVal);
      if (norm) {
        tempMap[colIdx] = norm;
        if (
          norm.includes("BANKNAME") ||
          norm.includes("BRANCHNAME") ||
          norm.includes("ADSCODE") ||
          norm.includes("LCID") ||
          norm.includes("LCVALUE") ||
          norm.includes("LCNATURE") ||
          norm.includes("APPLICANT") ||
          norm.includes("BENEFICIARY") ||
          norm.includes("BONDLIC")
        ) {
          matchCount++;
        }
      }
    });

    // If at least 2 key columns match, this is our true table header row
    if (matchCount >= 2) {
      headerRowIndex = r;
      Object.assign(headerMap, tempMap);
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      "Could not locate the actual table header row in the file. Please ensure columns like BANK_NAME, LC ID, LC_VALUE, etc. exist."
    );
  }

  // 2. Extract and validate data rows starting right after the header row
  const rows: ParsedBondLcRow[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawData: Record<string, any> = {};

    let bankName = "";
    let branchName = "";
    let adsCode = "";
    let lcYear = "";
    let lcNature = "";
    let lcSerial = "";
    let lcId = "";
    let lcValue = 0;
    let currency = "USD";
    let lcDate: Date | undefined;
    let lcExpiryDate: Date | undefined;
    let bbUsansePeriod = "";
    let lastShipDate: Date | undefined;
    let irc = "";
    let exporterInfo = "";
    let applicantName = "";
    let exportLcNumber = "";
    let proceedsDate: Date | undefined;
    let beneficiaryBank = "";
    let beneficiaryBranch = "";
    let beneficiaryName = "";
    let beneficiaryAddress = "";
    let beneficiaryIrc = "";
    let beneficiaryErc = "";
    let piNumber = "";
    let piDate: Date | undefined;
    let bondLicense = "";
    let accepted = "";
    let cancelYn = "N";
    let cancelCause = "";
    let entryDate: Date | undefined;

    row.forEach((val, colIdx) => {
      const key = headerMap[colIdx];
      if (!key) return;

      rawData[key] = val;

      if (key === "BANKNAME" || key.includes("BANKNAME")) {
        bankName = String(val || "").trim();
      } else if (key === "BRANCHNAME") {
        branchName = String(val || "").trim();
      } else if (key === "ADSCODE") {
        adsCode = String(val || "").trim();
      } else if (key === "LCYEAR") {
        lcYear = String(val || "").trim();
      } else if (key === "LCNATURE") {
        lcNature = String(val || "").trim();
      } else if (key === "LCSERIAL") {
        lcSerial = String(val || "").trim();
      } else if (key === "LCID") {
        lcId = String(val || "").trim();
      } else if (key === "LCVALUE" || key.includes("VALUE")) {
        lcValue = parseNumeric(val, 0);
      } else if (key === "LCDATE") {
        lcDate = parseExcelDate(val);
      } else if (key === "LCEXPIRYDATE" || key.includes("EXPIRY")) {
        lcExpiryDate = parseExcelDate(val);
      } else if (key === "BBUSANSEPERIOD" || key.includes("USANSE") || key.includes("USANCE")) {
        bbUsansePeriod = String(val || "").trim();
      } else if (key === "LASTSHIPDATE" || key.includes("SHIP")) {
        lastShipDate = parseExcelDate(val);
      } else if (key === "IRC") {
        irc = String(val || "").trim();
      } else if (key === "EXPORTERINFO" || key.includes("EXPORTER")) {
        exporterInfo = String(val || "").trim();
      } else if (key === "APPLICANTNAME" || key.includes("APPLICANT")) {
        applicantName = String(val || "").trim();
      } else if (key === "EXPORTLCNUMBER" || key.includes("EXPORTLC")) {
        exportLcNumber = String(val || "").trim();
      } else if (key === "CURRENCY") {
        currency = String(val || "USD").trim().toUpperCase();
      } else if (key === "PROCEEDSDATE" || key.includes("PROCEEDS")) {
        proceedsDate = parseExcelDate(val);
      } else if (key === "BENEFICIARYBANK") {
        beneficiaryBank = String(val || "").trim();
      } else if (key === "BENIFICIARYBRANCH" || key === "BENEFICIARYBRANCH") {
        beneficiaryBranch = String(val || "").trim();
      } else if (key === "BENEFICIARYNAME" || key.includes("BENEFICIARYNAME")) {
        beneficiaryName = String(val || "").trim();
      } else if (key === "BENEFICIARYADDRESS") {
        beneficiaryAddress = String(val || "").trim();
      } else if (key === "BENEFICIARYIRC") {
        beneficiaryIrc = String(val || "").trim();
      } else if (key === "BENEFICIARYERC") {
        beneficiaryErc = String(val || "").trim();
      } else if (key === "PINUMBER" || key.includes("PINUM")) {
        piNumber = String(val || "").trim();
      } else if (key === "PIDATE") {
        piDate = parseExcelDate(val);
      } else if (key === "BONDLICENSE" || key.includes("BONDLIC")) {
        bondLicense = String(val || "").trim();
      } else if (key === "ACCEPTED") {
        accepted = String(val || "").trim();
      } else if (key === "CANCELYN" || key.includes("CANCELYN")) {
        cancelYn = String(val || "N").trim().toUpperCase();
      } else if (key === "CANCELCAUSE" || key.includes("CAUSE")) {
        cancelCause = String(val || "").trim();
      } else if (key === "ENTRYDATE") {
        entryDate = parseExcelDate(val);
      }
    });

    // CRITICAL REQUIREMENT: Rows without BANK_NAME are NOT uploaded
    if (!bankName || bankName.trim() === "" || bankName.toLowerCase().startsWith("total") || bankName.toLowerCase().startsWith("grand")) {
      continue;
    }

    if (!lcId) {
      lcId = lcSerial ? `LC-${lcSerial}` : `LC-ROW-${r + 1}`;
    }

    rows.push({
      bankName: bankName.trim(),
      branchName: branchName.trim(),
      adsCode: adsCode.trim(),
      lcYear: lcYear.trim(),
      lcNature: lcNature.trim() || "General",
      lcSerial: lcSerial.trim(),
      lcId: lcId.trim(),
      lcValue,
      currency: currency || "USD",
      lcDate,
      lcExpiryDate,
      bbUsansePeriod: bbUsansePeriod.trim(),
      lastShipDate,
      proceedsDate,
      irc: irc.trim(),
      exporterInfo: exporterInfo.trim(),
      applicantName: applicantName.trim() || "Unknown Applicant",
      exportLcNumber: exportLcNumber.trim(),
      beneficiaryBank: beneficiaryBank.trim(),
      beneficiaryBranch: beneficiaryBranch.trim(),
      beneficiaryName: beneficiaryName.trim(),
      beneficiaryAddress: beneficiaryAddress.trim(),
      beneficiaryIrc: beneficiaryIrc.trim(),
      beneficiaryErc: beneficiaryErc.trim(),
      piNumber: piNumber.trim(),
      piDate,
      bondLicense: bondLicense.trim() || "N/A",
      accepted: accepted.trim() || "Y",
      cancelYn: cancelYn === "Y" ? "Y" : "N",
      cancelCause: cancelCause.trim(),
      entryDate,
      rawData
    });
  }

  return rows;
}

/**
 * Calculate analytical KPIs and breakdown distributions
 */
export function calculateAnalyticalSummary(rows: ParsedBondLcRow[]): AnalyticalSummary {
  const totalRecords = rows.length;
  let totalLcValue = 0;
  let totalAccepted = 0;
  let totalCancelled = 0;

  const currencyTotals: Record<string, number> = {};
  const bankBreakdown: Record<string, { count: number; totalValue: number }> = {};
  const natureBreakdown: Record<string, number> = {};
  const bondLicenseBreakdown: Record<string, { count: number; totalValue: number }> = {};
  const applicantMap: Record<string, { count: number; totalValue: number }> = {};

  for (const r of rows) {
    totalLcValue += r.lcValue;

    // Currency totals
    const curr = r.currency || "USD";
    currencyTotals[curr] = (currencyTotals[curr] || 0) + r.lcValue;

    // Status counts
    if (r.cancelYn === "Y") {
      totalCancelled++;
    } else {
      totalAccepted++;
    }

    // Bank Breakdown
    const bKey = r.bankName || "Other Bank";
    if (!bankBreakdown[bKey]) {
      bankBreakdown[bKey] = { count: 0, totalValue: 0 };
    }
    bankBreakdown[bKey].count += 1;
    bankBreakdown[bKey].totalValue += r.lcValue;

    // LC Nature Breakdown
    const nKey = r.lcNature || "General";
    natureBreakdown[nKey] = (natureBreakdown[nKey] || 0) + 1;

    // Bond License Breakdown
    const licKey = r.bondLicense || "Unspecified License";
    if (!bondLicenseBreakdown[licKey]) {
      bondLicenseBreakdown[licKey] = { count: 0, totalValue: 0 };
    }
    bondLicenseBreakdown[licKey].count += 1;
    bondLicenseBreakdown[licKey].totalValue += r.lcValue;

    // Top Applicants
    const appKey = r.applicantName || "Unknown Applicant";
    if (!applicantMap[appKey]) {
      applicantMap[appKey] = { count: 0, totalValue: 0 };
    }
    applicantMap[appKey].count += 1;
    applicantMap[appKey].totalValue += r.lcValue;
  }

  const topApplicants = Object.entries(applicantMap)
    .map(([name, data]) => ({ name, count: data.count, totalValue: Number(data.totalValue.toFixed(2)) }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);

  return {
    totalRecords,
    totalLcValue: Number(totalLcValue.toFixed(2)),
    currencyTotals,
    totalAccepted,
    totalCancelled,
    bankBreakdown,
    natureBreakdown,
    bondLicenseBreakdown,
    topApplicants
  };
}

/**
 * Generates sample downloadable Excel file with the exact 31 columns
 */
export async function generateSampleExcelTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bangladesh Bank Bond & LC Analysis Engine";
  const sheet = workbook.addWorksheet("LC & Bond Data");

  // The 31 exact columns
  sheet.columns = [
    { header: "BANK_NAME", key: "bankName", width: 26 },
    { header: "BRANCH_NAME", key: "branchName", width: 22 },
    { header: "ADSCODE", key: "adsCode", width: 14 },
    { header: "LC_YEAR", key: "lcYear", width: 12 },
    { header: "LC_NATURE", key: "lcNature", width: 20 },
    { header: "LC_SERIAL", key: "lcSerial", width: 14 },
    { header: "LC ID", key: "lcId", width: 20 },
    { header: "LC_VALUE", key: "lcValue", width: 16 },
    { header: "LC_DATE", key: "lcDate", width: 14 },
    { header: "LC_EXPIRY_DATE", key: "lcExpiryDate", width: 16 },
    { header: "BB_USANSE_PERIOD", key: "bbUsansePeriod", width: 18 },
    { header: "LAST_SHIP_DATE", key: "lastShipDate", width: 16 },
    { header: "IRC", key: "irc", width: 16 },
    { header: "EXPORTER_INFO", key: "exporterInfo", width: 28 },
    { header: "APPLICANT_NAME", key: "applicantName", width: 28 },
    { header: "EXPORT_LC_NUMBER", key: "exportLcNumber", width: 22 },
    { header: "CURRENCY", key: "currency", width: 12 },
    { header: "PROCEEDS_DATE", key: "proceedsDate", width: 16 },
    { header: "BENEFICIARY_BANK", key: "beneficiaryBank", width: 26 },
    { header: "BENIFICIARY_BRANCH", key: "beneficiaryBranch", width: 22 },
    { header: "BENEFICIARY_NAME", key: "beneficiaryName", width: 28 },
    { header: "BENEFICIARY_ADDRESS", key: "beneficiaryAddress", width: 32 },
    { header: "BENEFICIARY_IRC", key: "beneficiaryIrc", width: 18 },
    { header: "BENEFICIARY_ERC", key: "beneficiaryErc", width: 18 },
    { header: "PI_NUMBER", key: "piNumber", width: 18 },
    { header: "PI_DATE", key: "piDate", width: 14 },
    { header: "Bond License", key: "bondLicense", width: 20 },
    { header: "ACCEPTED", key: "accepted", width: 12 },
    { header: "CANCEL_YN", key: "cancelYn", width: 12 },
    { header: "CANCEL_CAUSE", key: "cancelCause", width: 24 },
    { header: "Entry Date", key: "entryDate", width: 14 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  const sampleRows = [
    {
      bankName: "Eastern Bank PLC",
      branchName: "Principal Branch",
      adsCode: "EBL001",
      lcYear: "2026",
      lcNature: "Back to Back",
      lcSerial: "LC-2026-001",
      lcId: "10520260012",
      lcValue: 85000.5,
      lcDate: "2026-01-10",
      lcExpiryDate: "2026-06-30",
      bbUsansePeriod: "120 Days",
      lastShipDate: "2026-05-30",
      irc: "IRC-987456",
      exporterInfo: "Zhejiang Textiles Co. Ltd, China",
      applicantName: "Apex Apparels & Textiles Ltd",
      exportLcNumber: "EXP-LC-554411",
      currency: "USD",
      proceedsDate: "2026-07-15",
      beneficiaryBank: "Bank of China",
      beneficiaryBranch: "Shanghai Main",
      beneficiaryName: "Zhejiang Textiles Co. Ltd",
      beneficiaryAddress: "No. 88 Silk Road, Hangzhou, China",
      beneficiaryIrc: "CN-IRC-1122",
      beneficiaryErc: "CN-ERC-3344",
      piNumber: "PI-2026-990",
      piDate: "2026-01-05",
      bondLicense: "BL-CTG-2024-889",
      accepted: "Y",
      cancelYn: "N",
      cancelCause: "",
      entryDate: "2026-01-11"
    }
  ];

  sampleRows.forEach((r) => sheet.addRow(r));

  const exportBuf = await workbook.xlsx.writeBuffer();
  return Buffer.from(exportBuf);
}

function safeFormatIsoDate(val: any): string {
  if (!val) return "-";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "-";
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str || str === "-" || str === "N/A") return "-";
  const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch (_) {}
  return "-";
}

/**
 * Generates an analytical export Excel report using high-performance SheetJS (XLSX)
 */
export async function generateExportReportExcel(
  upload: any,
  records: any[],
  summary: AnalyticalSummary
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const summaryAoa = [
    ["LC & BOND PORTFOLIO ANALYSIS REPORT: " + (upload.originalName || "Report")],
    [],
    ["Metric Indicator", "Summary Value"],
    ["Total LC Records", summary.totalRecords],
    ["Total LC Value (USD Equivalent)", summary.totalLcValue],
    ["Active / Accepted LCs", summary.totalAccepted],
    ["Cancelled LCs", summary.totalCancelled],
    ["Total Issuing Banks", Object.keys(summary.bankBreakdown || {}).length],
    ["Total Bond Licenses", Object.keys(summary.bondLicenseBreakdown || {}).length],
    ["Report Generated Date", new Date().toLocaleString()]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary["!cols"] = [{ wch: 32 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  // Sheet 2: The 11 Specified Columns Detail Table
  const headers = [
    "#",
    "BANK_NAME",
    "BRANCH_NAME",
    "LC ID",
    "LC_VALUE",
    "LC_DATE",
    "LC_EXPIRY_DATE",
    "EXPORTER_INFO",
    "BENEFICIARY_BANK",
    "BENEFICIARY_NAME",
    "BENEFICIARY_ADDRESS",
    "Entry Date"
  ];

  const detailAoa: any[][] = [headers];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    detailAoa.push([
      i + 1,
      r.bankName || "",
      r.branchName || "-",
      r.lcId || "",
      Number(r.lcValue || 0),
      safeFormatIsoDate(r.lcDate),
      safeFormatIsoDate(r.lcExpiryDate),
      r.exporterInfo || "-",
      r.beneficiaryBank || "-",
      r.beneficiaryName || "-",
      r.beneficiaryAddress || "-",
      safeFormatIsoDate(r.entryDate)
    ]);
  }

  const wsDetail = XLSX.utils.aoa_to_sheet(detailAoa);
  wsDetail["!cols"] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 22 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 },
    { wch: 26 },
    { wch: 28 },
    { wch: 34 },
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "LC & Bond Report");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}
