import axios from "axios";
import { computed, ref } from "vue";
import * as XLSX from "xlsx";

export interface BondRecord {
  id: number;
  bankName: string;
  branchName?: string;
  adsCode?: string;
  lcYear?: string;
  lcNature?: string;
  lcSerial?: string;
  lcId?: string;
  lcValue: string | number;
  currency?: string;
  lcDate?: string;
  lcExpiryDate?: string;
  bbUsansePeriod?: string;
  lastShipDate?: string;
  proceedsDate?: string;
  irc?: string;
  exporterInfo?: string;
  applicantName?: string;
  exportLcNumber?: string;
  beneficiaryBank?: string;
  beneficiaryBranch?: string;
  beneficiaryName?: string;
  beneficiaryAddress?: string;
  beneficiaryIrc?: string;
  beneficiaryErc?: string;
  piNumber?: string;
  piDate?: string;
  bondLicense?: string;
  accepted?: string;
  cancelYn?: string;
  cancelCause?: string;
  entryDate?: string;
  createdAt?: string;
}

export interface AnalyticalSummary {
  totalRecords: number;
  totalLcValue: number;
  currencyTotals: Record<string, number>;
  totalAccepted: number;
  totalCancelled: number;
  bankBreakdown: Record<string, { count: number; totalValue: number }>;
  bondLicenseBreakdown: Record<string, { count: number; totalValue: number }>;
}

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

export function parseExcelDate(val: any): string | undefined {
  if (val === null || val === undefined || val === "") return undefined;

  // 1. If raw number (Excel date serial number e.g. 45685 for 28-Jan-2025)
  if (typeof val === "number") {
    try {
      if ((XLSX as any)?.SSF?.parse_date_code) {
        const parsed = (XLSX as any).SSF.parse_date_code(val);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          const y = String(parsed.y).padStart(4, "0");
          const m = String(parsed.m).padStart(2, "0");
          const d = String(parsed.d).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
      }
    } catch (_) {}

    // Fallback for number: convert serial days (Excel epoch 1899-12-30)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return undefined;
  }

  // 2. If Date instance: extract local calendar parts
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return undefined;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 3. If string
  const str = String(val).trim();
  if (!str || str === "-" || str === "N/A") return undefined;

  // Match 28-Jan-25 or 28-Jan-2025 or 28/Jan/25 or 28 Jan 2025 or 28-JAN-25
  const monMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/);
  if (monMatch) {
    const d = monMatch[1].padStart(2, "0");
    const mNum = parseMonth(monMatch[2]);
    let yr = monMatch[3];
    if (yr.length === 2) {
      yr = Number(yr) > 50 ? "19" + yr : "20" + yr;
    }
    if (mNum > 0) {
      return `${yr}-${String(mNum).padStart(2, "0")}-${d}`;
    }
  }

  // Match YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // Match DD-MM-YY or DD/MM/YY
  const dmyShort = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShort) {
    const yr = Number(dmyShort[3]) > 50 ? "19" + dmyShort[3] : "20" + dmyShort[3];
    return `${yr}-${dmyShort[2].padStart(2, "0")}-${dmyShort[1].padStart(2, "0")}`;
  }

  return undefined;
}

function parseNumeric(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : num;
}

export interface BondFilterParams {
  search?: string;
  bank?: string;
  beneficiaryBank?: string;
  lcDateStart?: string;
  lcDateEnd?: string;
  piDateStart?: string;
  piDateEnd?: string;
  entryDateStart?: string;
  entryDateEnd?: string;
  page?: number;
  limit?: number;
}

export function useBond() {
  const loading = ref(false);
  const uploading = ref(false);
  const isCommitting = ref(false);
  const uploadProgress = ref(0);
  const uploadStatusText = ref("");
  const records = ref<BondRecord[]>([]);
  const summary = ref<AnalyticalSummary | null>(null);
  const pagination = ref({ page: 1, limit: 10, total: 0 });
  const error = ref<string | null>(null);

  // Data Preview State
  const previewFile = ref<File | null>(null);
  const previewRows = ref<any[]>([]);
  const isPreviewMode = computed(() => previewRows.value.length > 0);

  /**
   * Fetch Summary KPIs (with optional active filters)
   */
  async function fetchSummary(filters: BondFilterParams = {}) {
    try {
      const res = await axios.get("/api/bond/summary", {
        params: {
          search: filters.search || undefined,
          bank: filters.bank || undefined,
          beneficiaryBank: filters.beneficiaryBank || undefined,
          lcDateStart: filters.lcDateStart || undefined,
          lcDateEnd: filters.lcDateEnd || undefined,
          piDateStart: filters.piDateStart || undefined,
          piDateEnd: filters.piDateEnd || undefined,
          entryDateStart: filters.entryDateStart || undefined,
          entryDateEnd: filters.entryDateEnd || undefined
        }
      });
      summary.value = res.data?.data || null;
    } catch (err: any) {
      console.error("Failed to load summary:", err);
    }
  }

  /**
   * Fetch Records with filters, smart date ranges, and pagination
   */
  async function fetchRecords(filters: BondFilterParams = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.get("/api/bond/records", {
        params: {
          search: filters.search || undefined,
          bank: filters.bank || undefined,
          beneficiaryBank: filters.beneficiaryBank || undefined,
          lcDateStart: filters.lcDateStart || undefined,
          lcDateEnd: filters.lcDateEnd || undefined,
          piDateStart: filters.piDateStart || undefined,
          piDateEnd: filters.piDateEnd || undefined,
          entryDateStart: filters.entryDateStart || undefined,
          entryDateEnd: filters.entryDateEnd || undefined,
          page: filters.page || pagination.value.page,
          limit: filters.limit || pagination.value.limit
        }
      });
      records.value = res.data?.data || [];
      if (res.data?.meta) {
        pagination.value.page = res.data.meta.page;
        pagination.value.total = res.data.meta.total;
      }
      await fetchSummary(filters);
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to fetch records";
    } finally {
      loading.value = false;
    }
  }

  /**
   * Parse rows on client with dynamic header scanning and BANK_NAME validation
   */
  async function parseFileRows(file: File, progressCallback?: (pct: number, status: string) => void): Promise<any[]> {
    progressCallback?.(15, `Reading file ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();

    progressCallback?.(35, "Parsing Excel sheets and workbook structures...");
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("No sheet found in file");

    const worksheet = workbook.Sheets[sheetName];
    progressCallback?.(55, "Extracting rows and scanning header rows...");
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", blankrows: false });
    if (!rawRows || rawRows.length === 0) throw new Error("File is empty");

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

      if (matchCount >= 2) {
        headerRowIndex = r;
        Object.assign(headerMap, tempMap);
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error("Could not find table header row (e.g. BANK_NAME, LC ID, LC_VALUE).");
    }

    progressCallback?.(75, `Processing ${rawRows.length - headerRowIndex - 1} records and validating BANK_NAME...`);
    const rows: any[] = [];

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      let bankName = "";
      let branchName = "";
      let adsCode = "";
      let lcYear = "";
      let lcNature = "";
      let lcSerial = "";
      let lcId = "";
      let lcValue = 0;
      let currency = "USD";
      let lcDate: string | undefined;
      let lcExpiryDate: string | undefined;
      let bbUsansePeriod = "";
      let lastShipDate: string | undefined;
      let irc = "";
      let exporterInfo = "";
      let applicantName = "";
      let exportLcNumber = "";
      let proceedsDate: string | undefined;
      let beneficiaryBank = "";
      let beneficiaryBranch = "";
      let beneficiaryName = "";
      let beneficiaryAddress = "";
      let beneficiaryIrc = "";
      let beneficiaryErc = "";
      let piNumber = "";
      let piDate: string | undefined;
      let bondLicense = "";
      let accepted = "";
      let cancelYn = "N";
      let cancelCause = "";
      let entryDate: string | undefined;

      row.forEach((val, colIdx) => {
        const key = headerMap[colIdx];
        if (!key) return;

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

      // Filter: rows without BANK_NAME are skipped
      if (!bankName || bankName.trim() === "" || bankName.toLowerCase().startsWith("total") || bankName.toLowerCase().startsWith("grand")) {
        continue;
      }

      if (!lcId) {
        lcId = lcSerial ? `LC-${lcSerial}` : `LC-ROW-${r + 1}`;
      }

      rows.push({
        bankName,
        branchName,
        adsCode,
        lcYear,
        lcNature: lcNature || "General",
        lcSerial,
        lcId,
        lcValue,
        currency: currency || "USD",
        lcDate,
        lcExpiryDate,
        bbUsansePeriod,
        lastShipDate,
        proceedsDate,
        irc,
        exporterInfo,
        applicantName: applicantName || "Unknown Applicant",
        exportLcNumber,
        beneficiaryBank,
        beneficiaryBranch,
        beneficiaryName,
        beneficiaryAddress,
        beneficiaryIrc,
        beneficiaryErc,
        piNumber,
        piDate,
        bondLicense: bondLicense || "N/A",
        accepted: accepted || "Y",
        cancelYn: cancelYn === "Y" ? "Y" : "N",
        cancelCause,
        entryDate
      });
    }

    progressCallback?.(95, `Found ${rows.length.toLocaleString()} valid records. Preparing data preview...`);
    return rows;
  }

  /**
   * 1. Prepare Data Preview from Chosen File (With live freeze progress bar)
   */
  async function prepareFilePreview(file: File) {
    isCommitting.value = false;
    uploading.value = true;
    uploadProgress.value = 10;
    uploadStatusText.value = `Reading ${file.name}...`;
    error.value = null;

    try {
      const validRows = await parseFileRows(file, (pct, status) => {
        uploadProgress.value = pct;
        uploadStatusText.value = status;
      });

      if (validRows.length === 0) {
        throw new Error("No valid rows with BANK_NAME found in the selected file.");
      }

      uploadProgress.value = 100;
      uploadStatusText.value = "Data preview ready!";
      previewFile.value = file;
      previewRows.value = validRows;
    } catch (err: any) {
      error.value = err.message || "Failed to parse file for preview.";
      throw err;
    } finally {
      setTimeout(() => {
        uploading.value = false;
        uploadProgress.value = 0;
        uploadStatusText.value = "";
      }, 500);
    }
  }

  /**
   * 2. Cancel Preview Mode
   */
  function cancelPreview() {
    previewFile.value = null;
    previewRows.value = [];
  }

  /**
   * 3. Commit Preview Data to Database in Chunks of 1,000 with live Progress Bar %
   */
  async function commitPreviewToDatabase() {
    if (!previewFile.value || previewRows.value.length === 0) return;

    const validRows = previewRows.value;
    isCommitting.value = true;
    uploading.value = true;
    uploadProgress.value = 5;
    uploadStatusText.value = `Starting database commit for ${validRows.length.toLocaleString()} records...`;
    error.value = null;

    try {
      const chunkSize = 1000;
      const totalChunks = Math.ceil(validRows.length / chunkSize);

      for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
        const start = cIdx * chunkSize;
        const end = Math.min(start + chunkSize, validRows.length);
        const chunkRecords = validRows.slice(start, end);

        const chunkPercent = Math.round(((cIdx + 1) / totalChunks) * 100);
        uploadProgress.value = Math.min(chunkPercent, 98);
        uploadStatusText.value = `Saving chunk ${cIdx + 1} of ${totalChunks} (${end.toLocaleString()} of ${validRows.length.toLocaleString()} records)...`;

        await axios.post("/api/bond/upload/chunk", {
          chunkIndex: cIdx + 1,
          totalChunks,
          records: chunkRecords
        });
      }

      uploadProgress.value = 100;
      uploadStatusText.value = "All records saved to database successfully!";

      // Clear preview state
      cancelPreview();

      // Refresh data
      await fetchRecords();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save to database.";
      error.value = msg;
      throw new Error(msg);
    } finally {
      setTimeout(() => {
        uploading.value = false;
        isCommitting.value = false;
        uploadProgress.value = 0;
        uploadStatusText.value = "";
      }, 700);
    }
  }

  /**
   * Export report with active filters
   */
  function exportReport(filters: BondFilterParams = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append("search", filters.search);
    if (filters.bank) params.append("bank", filters.bank);
    if (filters.beneficiaryBank) params.append("beneficiaryBank", filters.beneficiaryBank);
    if (filters.lcDateStart) params.append("lcDateStart", filters.lcDateStart);
    if (filters.lcDateEnd) params.append("lcDateEnd", filters.lcDateEnd);
    if (filters.piDateStart) params.append("piDateStart", filters.piDateStart);
    if (filters.piDateEnd) params.append("piDateEnd", filters.piDateEnd);
    if (filters.entryDateStart) params.append("entryDateStart", filters.entryDateStart);
    if (filters.entryDateEnd) params.append("entryDateEnd", filters.entryDateEnd);

    const queryStr = params.toString();
    const url = queryStr ? `/api/bond/export?${queryStr}` : "/api/bond/export";
    window.open(url, "_blank");
  }

  /**
   * Clear all records
   */
  async function clearAllRecords() {
    if (!confirm("Are you sure you want to delete all records from the database?")) return;
    loading.value = true;
    try {
      await axios.delete("/api/bond/records");
      records.value = [];
      summary.value = null;
      await fetchRecords();
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to clear records";
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    uploading,
    isCommitting,
    uploadProgress,
    uploadStatusText,
    records,
    summary,
    pagination,
    error,
    previewFile,
    previewRows,
    isPreviewMode,
    prepareFilePreview,
    cancelPreview,
    commitPreviewToDatabase,
    fetchRecords,
    fetchSummary,
    exportReport,
    clearAllRecords
  };
}
