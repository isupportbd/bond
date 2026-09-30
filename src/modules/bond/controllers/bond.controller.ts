import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { bondRecords } from "@/modules/bond/database/models/bond.js";
import {
  generateExportReportExcel,
  generateSampleExcelTemplate
} from "@/modules/bond/helpers/excel-parser.js";

function parseFilterDate(str: string, endOfDay = false): Date | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    return endOfDay
      ? new Date(Date.UTC(y, m, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  }
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (_) {}
  return null;
}

/**
 * Builds standard filter conditions for Search, Bank, and Start/End Date Ranges
 */
function buildFilterConditions(query: Record<string, any>) {
  const conditions: any[] = [];
  const search = (query.search || "").trim();
  const bank = (query.bank || "").trim();
  const beneficiaryBank = (query.beneficiaryBank || "").trim();

  const lcDateStart = parseFilterDate(query.lcDateStart, false);
  const lcDateEnd = parseFilterDate(query.lcDateEnd, true);

  const piDateStart = parseFilterDate(query.piDateStart, false);
  const piDateEnd = parseFilterDate(query.piDateEnd, true);

  const entryDateStart = parseFilterDate(query.entryDateStart, false);
  const entryDateEnd = parseFilterDate(query.entryDateEnd, true);

  if (search) {
    conditions.push(
      or(
        ilike(bondRecords.lcId, `%${search}%`),
        ilike(bondRecords.lcSerial, `%${search}%`),
        ilike(bondRecords.applicantName, `%${search}%`),
        ilike(bondRecords.beneficiaryName, `%${search}%`),
        ilike(bondRecords.beneficiaryBank, `%${search}%`),
        ilike(bondRecords.exporterInfo, `%${search}%`),
        ilike(bondRecords.bankName, `%${search}%`),
        ilike(bondRecords.branchName, `%${search}%`),
        ilike(bondRecords.piNumber, `%${search}%`),
        ilike(bondRecords.bondLicense, `%${search}%`)
      )
    );
  }

  if (bank) {
    conditions.push(eq(bondRecords.bankName, bank));
  }

  if (beneficiaryBank) {
    conditions.push(eq(bondRecords.beneficiaryBank, beneficiaryBank));
  }

  // LC Date Range (Start & End)
  if (lcDateStart) {
    conditions.push(gte(bondRecords.lcDate, lcDateStart));
  }
  if (lcDateEnd) {
    conditions.push(lte(bondRecords.lcDate, lcDateEnd));
  }

  // PI Date Range (Start & End)
  if (piDateStart) {
    conditions.push(gte(bondRecords.piDate, piDateStart));
  }
  if (piDateEnd) {
    conditions.push(lte(bondRecords.piDate, piDateEnd));
  }

  // Entry Date Range (Start & End)
  if (entryDateStart) {
    conditions.push(gte(bondRecords.entryDate, entryDateStart));
  }
  if (entryDateEnd) {
    conditions.push(lte(bondRecords.entryDate, entryDateEnd));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * 1. Process One Chunk of Records (Stream directly into bondRecords)
 * Route: POST /upload/chunk
 */
export const processUploadChunk: Handler = async (c: any) => {
  try {
    const body = await c.req.json();
    const chunkIndex = Number(body.chunkIndex || 1);
    const totalChunks = Number(body.totalChunks || 1);
    const records: any[] = body.records || [];

    if (!Array.isArray(records) || records.length === 0) {
      return c.json({ message: "No records found in payload" }, HttpStatusCodes.BAD_REQUEST);
    }

    const rowsToInsert = records.map((r) => ({
      bankName: r.bankName,
      branchName: r.branchName || null,
      adsCode: r.adsCode || null,
      lcYear: r.lcYear || null,
      lcNature: r.lcNature || null,
      lcSerial: r.lcSerial || null,
      lcId: r.lcId || null,
      lcValue: String(r.lcValue || 0),
      currency: r.currency || "USD",
      lcDate: r.lcDate ? new Date(r.lcDate) : null,
      lcExpiryDate: r.lcExpiryDate ? new Date(r.lcExpiryDate) : null,
      bbUsansePeriod: r.bbUsansePeriod || null,
      lastShipDate: r.lastShipDate ? new Date(r.lastShipDate) : null,
      proceedsDate: r.proceedsDate ? new Date(r.proceedsDate) : null,
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
      piNumber: r.piNumber ? String(r.piNumber).trim() : null,
      piDate: r.piDate ? new Date(r.piDate) : null,
      bondLicense: r.bondLicense || null,
      accepted: r.accepted || null,
      cancelYn: r.cancelYn || "N",
      cancelCause: r.cancelCause || null,
      entryDate: r.entryDate ? new Date(r.entryDate) : null
    }));

    // Split rows: those with composite unique key (piNumber + piDate) vs others
    const keyedMap = new Map<string, typeof rowsToInsert[0]>();
    const unkeyedRows: typeof rowsToInsert = [];

    for (const row of rowsToInsert) {
      if (row.piNumber && row.piDate && !isNaN(row.piDate.getTime())) {
        const key = `${row.piNumber.toUpperCase()}__${row.piDate.toISOString()}`;
        keyedMap.set(key, row); // Later row in file overrides earlier duplicate in chunk
      } else {
        unkeyedRows.push(row);
      }
    }

    const keyedRows = Array.from(keyedMap.values());

    if (keyedRows.length > 0) {
      await db
        .insert(bondRecords)
        .values(keyedRows)
        .onConflictDoUpdate({
          target: [bondRecords.piNumber, bondRecords.piDate],
          set: {
            bankName: sql`excluded.bank_name`,
            branchName: sql`excluded.branch_name`,
            adsCode: sql`excluded.ads_code`,
            lcYear: sql`excluded.lc_year`,
            lcNature: sql`excluded.lc_nature`,
            lcSerial: sql`excluded.lc_serial`,
            lcId: sql`excluded.lc_id`,
            lcValue: sql`excluded.lc_value`,
            currency: sql`excluded.currency`,
            lcDate: sql`excluded.lc_date`,
            lcExpiryDate: sql`excluded.lc_expiry_date`,
            bbUsansePeriod: sql`excluded.bb_usanse_period`,
            lastShipDate: sql`excluded.last_ship_date`,
            proceedsDate: sql`excluded.proceeds_date`,
            irc: sql`excluded.irc`,
            exporterInfo: sql`excluded.exporter_info`,
            applicantName: sql`excluded.applicant_name`,
            exportLcNumber: sql`excluded.export_lc_number`,
            beneficiaryBank: sql`excluded.beneficiary_bank`,
            beneficiaryBranch: sql`excluded.beneficiary_branch`,
            beneficiaryName: sql`excluded.beneficiary_name`,
            beneficiaryAddress: sql`excluded.beneficiary_address`,
            beneficiaryIrc: sql`excluded.beneficiary_irc`,
            beneficiaryErc: sql`excluded.beneficiary_erc`,
            bondLicense: sql`excluded.bond_license`,
            accepted: sql`excluded.accepted`,
            cancelYn: sql`excluded.cancel_yn`,
            cancelCause: sql`excluded.cancel_cause`,
            entryDate: sql`excluded.entry_date`,
            updatedAt: new Date()
          }
        });
    }

    if (unkeyedRows.length > 0) {
      await db.insert(bondRecords).values(unkeyedRows);
    }

    return c.json({
      message: `Chunk ${chunkIndex}/${totalChunks} processed successfully`,
      data: {
        chunkIndex,
        totalChunks,
        insertedOrUpdated: keyedRows.length + unkeyedRows.length
      }
    });
  } catch (error: any) {
    console.error("Chunk insert/upsert error:", error);
    return c.json({ message: error?.message || "Failed to process chunk" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 2. Get Live Summary Metrics directly from bondRecords (Supports Filter Query)
 * Route: GET /summary
 */
export const getSummary: Handler = async (c: any) => {
  try {
    const whereClause = buildFilterConditions(c.req.query());
    const allRecords = await db.select().from(bondRecords).where(whereClause);

    const totalRecords = allRecords.length;
    let totalLcValue = 0;
    let totalAccepted = 0;
    let totalCancelled = 0;
    const currencyTotals: Record<string, number> = {};
    const bankBreakdown: Record<string, { count: number; totalValue: number }> = {};
    const bondLicenseBreakdown: Record<string, { count: number; totalValue: number }> = {};

    for (const r of allRecords) {
      const val = Number(r.lcValue || 0);
      totalLcValue += val;

      const curr = r.currency || "USD";
      currencyTotals[curr] = (currencyTotals[curr] || 0) + val;

      if (r.cancelYn === "Y") {
        totalCancelled++;
      } else {
        totalAccepted++;
      }

      const bank = r.bankName || "Other Bank";
      if (!bankBreakdown[bank]) {
        bankBreakdown[bank] = { count: 0, totalValue: 0 };
      }
      bankBreakdown[bank].count += 1;
      bankBreakdown[bank].totalValue += val;

      const lic = r.bondLicense || "Unspecified License";
      if (!bondLicenseBreakdown[lic]) {
        bondLicenseBreakdown[lic] = { count: 0, totalValue: 0 };
      }
      bondLicenseBreakdown[lic].count += 1;
      bondLicenseBreakdown[lic].totalValue += val;
    }

    return c.json({
      message: "Summary metrics calculated successfully",
      data: {
        totalRecords,
        totalLcValue: Number(totalLcValue.toFixed(2)),
        currencyTotals,
        totalAccepted,
        totalCancelled,
        bankBreakdown,
        bondLicenseBreakdown
      }
    });
  } catch (error: any) {
    console.error("Summary error:", error);
    return c.json({ message: error?.message || "Failed to calculate summary" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 3. Get Records with Filter, Search, Smart Date Range, Pagination
 * Route: GET /records
 */
export const listRecords: Handler = async (c: any) => {
  try {
    const query = c.req.query();
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(500, Math.max(1, Number(query.limit || 10)));
    const offset = (page - 1) * limit;

    const whereClause = buildFilterConditions(query);

    const records = await db
      .select()
      .from(bondRecords)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(bondRecords.id));

    const totalRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(bondRecords)
      .where(whereClause);

    const total = Number(totalRes[0]?.count || 0);

    return c.json({
      message: "Records fetched successfully",
      data: records,
      meta: {
        page,
        limit,
        total
      }
    });
  } catch (error: any) {
    console.error("List records error:", error);
    return c.json({ message: error?.message || "Failed to fetch records" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 4. Export Analytical Report as formatted Excel (Respects all Active Date & Bank Filters)
 * Route: GET /export
 */
export const exportReportExcel: Handler = async (c: any) => {
  try {
    const whereClause = buildFilterConditions(c.req.query());
    const records = await db.select().from(bondRecords).where(whereClause).orderBy(desc(bondRecords.id));

    const summary = {
      totalRecords: records.length,
      totalLcValue: records.reduce((sum, r) => sum + Number(r.lcValue || 0), 0),
      currencyTotals: {},
      totalAccepted: records.filter((r) => r.cancelYn !== "Y").length,
      totalCancelled: records.filter((r) => r.cancelYn === "Y").length,
      bankBreakdown: {},
      natureBreakdown: {},
      bondLicenseBreakdown: {},
      topApplicants: []
    };

    const buffer = await generateExportReportExcel(
      { originalName: "Bangladesh_Bank_Bond_Report" },
      records,
      summary
    );

    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", 'attachment; filename="Bond_LC_Portfolio_Report.xlsx"');
    return c.body(buffer);
  } catch (error: any) {
    console.error("Export error:", error);
    return c.json({ message: error?.message || "Failed to export report" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 5. Clear / Delete all records
 * Route: DELETE /records
 */
export const clearRecords: Handler = async (c: any) => {
  try {
    await db.delete(bondRecords);
    return c.json({ message: "All bond records cleared successfully." });
  } catch (error: any) {
    return c.json({ message: error?.message || "Failed to clear records" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
