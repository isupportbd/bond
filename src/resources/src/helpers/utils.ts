import axios from "axios";
import { DateTime } from "luxon";

declare const route: (name: string, params?: Record<string, unknown>) => string;

export function inArray<T>(needle: T, haystack: T[], strict = false): boolean {
  if (!Array.isArray(haystack)) {
    throw new TypeError("haystack must be an array");
  }

  if (strict) {
    return haystack.includes(needle);
  }

  for (const value of haystack) {
    if (value === needle) {
      return true;
    }

    if (typeof value === "number" && typeof needle === "number" && Number.isNaN(value) && Number.isNaN(needle)) {
      return true;
    }
  }

  return false;
}

export function empty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return v === 0 || Number.isNaN(v);
  if (typeof v === "bigint") return v === 0n;
  if (typeof v === "string") return v === "" || v === "0";
  if (Array.isArray(v)) return v.length === 0;
  if (v instanceof Map || v instanceof Set) return v.size === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;

  return false;
}

export async function downloadFile(url: string, fileName: string): Promise<void> {
  try {
    const isDirectUrl = url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://");
    const targetUrl = isDirectUrl ? url : route(url, { file_name: fileName });
    const res = await axios.get(targetUrl, { responseType: "blob" });
    if (res.data) {
      const objectUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    }
  } catch (e) {
    console.error("Export failed:", e);
  }
}

export async function downloadExcel(url: string, fileName: string): Promise<void> {
  await downloadFile(url, fileName);
}

export function formatTaxPeriod(value: string): string {
  if (!value) return "";
  const date = DateTime.fromFormat(value, "yyyy-MM");
  return date.isValid ? date.toFormat("MMM yyyy") : value;
}

export function formatDate(val: any): string {
  if (!val) return "-";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "-") return "-";
    // Check if it starts with YYYY-MM-DD
    const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }
    // Check if DD-MM-YYYY or DD/MM/YYYY
    const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "-";
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
