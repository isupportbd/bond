import { z } from "@/framework/facade.js";

export const BondIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const BondRecordFilterSchema = z.object({
  search: z.string().optional(),
  rating: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional()
});

export const BondUploadItemSchema = z.object({
  id: z.number(),
  fileName: z.string(),
  originalName: z.string(),
  fileSize: z.number(),
  totalRows: z.number(),
  status: z.string(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date())
});

export const BondRecordItemSchema = z.object({
  id: z.number(),
  uploadId: z.number(),
  bondName: z.string(),
  isin: z.string().nullable().optional(),
  issuer: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  rating: z.string().nullable().optional(),
  faceValue: z.string().or(z.number()),
  marketPrice: z.string().or(z.number()),
  couponRate: z.string().or(z.number()),
  yieldToMaturity: z.string().or(z.number()),
  quantity: z.number(),
  totalValue: z.string().or(z.number()),
  issueDate: z.string().or(z.date()).nullable().optional(),
  maturityDate: z.string().or(z.date()).nullable().optional(),
  remarks: z.string().nullable().optional()
});

export const BondReportSummarySchema = z.object({
  totalRecords: z.number(),
  totalFaceValue: z.number(),
  totalMarketValue: z.number(),
  avgCouponRate: z.number(),
  weightedAvgYTM: z.number(),
  ratingBreakdown: z.record(z.string(), z.number()),
  categoryBreakdown: z.record(z.string(), z.number()),
  maturityTimeline: z.record(z.string(), z.number())
});

export const BondMessageSchema = z.object({
  message: z.string()
});
