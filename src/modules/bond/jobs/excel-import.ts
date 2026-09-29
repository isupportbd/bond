import fs from "node:fs/promises";
import path from "node:path";
import { db, shouldQueue } from "@/framework/facade.js";
import { bondRecords } from "@/modules/bond/database/models/bond.js";
import { parseBondExcel } from "@/modules/bond/helpers/excel-parser.js";

export interface ExcelImportJobData {
  filePath: string;
  originalName: string;
}

/**
 * Queue Handler for Large Background Excel/CSV Imports (Lakhs of records)
 * - Safe memory chunking (1,000 rows per batch)
 * - Directly streams records into bondRecords table
 */
shouldQueue("bond.excel-import", "default", async (job) => {
  const { filePath, originalName } = job.data as ExcelImportJobData;

  console.log(`[Queue: bond.excel-import] Starting import for file=${originalName}`);

  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const buffer = await fs.readFile(fullPath);

    // Parse all valid rows using smart header detection & BANK_NAME filter
    const parsedRows = await parseBondExcel(buffer);

    if (!parsedRows || parsedRows.length === 0) {
      return { ok: false, error: "Empty valid rows" };
    }

    const totalRows = parsedRows.length;
    const chunkSize = 1000;
    const totalChunks = Math.ceil(totalRows / chunkSize);

    console.log(`[Queue: bond.excel-import] Found ${totalRows} valid rows across ${totalChunks} chunks.`);

    // Insert in batches of 1,000 records
    for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
      const start = cIdx * chunkSize;
      const end = Math.min(start + chunkSize, totalRows);
      const chunk = parsedRows.slice(start, end);

      const recordsToInsert = chunk.map((r) => ({
        bankName: r.bankName,
        branchName: r.branchName || null,
        adsCode: r.adsCode || null,
        lcYear: r.lcYear || null,
        lcNature: r.lcNature || null,
        lcSerial: r.lcSerial || null,
        lcId: r.lcId || null,
        lcValue: String(r.lcValue),
        currency: r.currency || "USD",
        lcDate: r.lcDate || null,
        lcExpiryDate: r.lcExpiryDate || null,
        bbUsansePeriod: r.bbUsansePeriod || null,
        lastShipDate: r.lastShipDate || null,
        proceedsDate: r.proceedsDate || null,
        irc: r.irc || null,
        exporterInfo: r.exporterInfo || null,
        applicantName: r.applicantName || null,
        exportLcNumber: r.exportLcNumber || null,
        beneficiaryBank: r.beneficiaryBank || null,
        beneficiaryBranch: r.beneficiaryBranch || null,
        beneficiaryName: r.beneficiaryName || null,
        beneficiaryAddress: r.beneficiaryAddress || null,
        beneficiaryIrc: r.beneficiaryIrc || null,
        beneficiaryErc: r.beneficiaryErc || null,
        piNumber: r.piNumber || null,
        piDate: r.piDate || null,
        bondLicense: r.bondLicense || null,
        accepted: r.accepted || null,
        cancelYn: r.cancelYn || "N",
        cancelCause: r.cancelCause || null,
        entryDate: r.entryDate || null
      }));

      await db.insert(bondRecords).values(recordsToInsert);

      // Yield event loop
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Clean up temp file
    try {
      await fs.unlink(fullPath);
    } catch {}

    console.log(`[Queue: bond.excel-import] Successfully inserted ${totalRows} records.`);
    return { ok: true, totalRows };
  } catch (err: any) {
    console.error(`[Queue: bond.excel-import] Failed:`, err);
    return { ok: false, error: err?.message };
  }
});
