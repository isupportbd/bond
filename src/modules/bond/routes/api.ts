import { createRouter } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import {
  clearRecords,
  exportReportExcel,
  getSummary,
  listRecords,
  processUploadChunk
} from "@/modules/bond/controllers/bond.controller.js";

const router = createRouter();

// Enforce authentication middleware across all bond data endpoints
router.use(authMiddleware);

// 1. Chunked 1,000-records Upload Endpoint (direct stream to bondRecords)
router.post("/upload/chunk", processUploadChunk);

// 2. Summary & KPIs Endpoint
router.get("/summary", getSummary);

// 3. Records with Filter & Pagination Endpoint
router.get("/records", listRecords);

// 4. Export 11-column Excel Report
router.get("/export", exportReportExcel);

// 5. Clear All Records
router.delete("/records", clearRecords);

export default router;
