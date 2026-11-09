import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/types/entries";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/types/job";
import type {
  ReceiptAnalysis,
  ReceiptAnalysisConfidence,
} from "@/types/receipt-analysis";

const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
const ANALYSIS_KEYS = [
  "vendor",
  "date",
  "total",
  "currency",
  "category",
  "notes",
  "confidence",
  "uncertainFields",
  "warnings",
] as const;

export class InvalidReceiptAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReceiptAnalysisError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new InvalidReceiptAnalysisError(`${field} must be a string or null.`);
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new InvalidReceiptAnalysisError(`${field} must be an array of strings.`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string"
    && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

function isCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string"
    && EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

function isConfidence(value: unknown): value is ReceiptAnalysisConfidence {
  return typeof value === "string"
    && CONFIDENCE_LEVELS.includes(value as ReceiptAnalysisConfidence);
}

export function currencyMismatchWarning(
  receiptCurrency: CurrencyCode | null,
  jobCurrency: CurrencyCode,
): string | null {
  if (!receiptCurrency || receiptCurrency === jobCurrency) return null;
  return `Receipt currency ${receiptCurrency} differs from job currency ${jobCurrency}. Confirm the amount before saving.`;
}

export function parseReceiptAnalysis(
  raw: string | unknown,
  jobCurrency: CurrencyCode,
): ReceiptAnalysis {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new InvalidReceiptAnalysisError("The receipt analysis was not valid JSON.");
    }
  }

  if (!isPlainObject(value)) {
    throw new InvalidReceiptAnalysisError("The receipt analysis must be an object.");
  }

  const unexpectedKeys = Object.keys(value).filter(
    (key) => !ANALYSIS_KEYS.includes(key as (typeof ANALYSIS_KEYS)[number]),
  );
  if (unexpectedKeys.length) {
    throw new InvalidReceiptAnalysisError("The receipt analysis contained unexpected fields.");
  }

  const vendor = nullableString(value.vendor, "vendor");
  const date = nullableString(value.date, "date");
  if (date && !isIsoCalendarDate(date)) {
    throw new InvalidReceiptAnalysisError("date must be a valid YYYY-MM-DD calendar date or null.");
  }

  if (
    value.total !== null
    && (typeof value.total !== "number" || !Number.isFinite(value.total) || value.total < 0)
  ) {
    throw new InvalidReceiptAnalysisError("total must be a finite non-negative number or null.");
  }
  const total = value.total as number | null;

  if (value.currency !== null && !isCurrency(value.currency)) {
    throw new InvalidReceiptAnalysisError("currency is not supported by MarginCheck.");
  }
  const currency = value.currency as CurrencyCode | null;

  if (value.category !== null && !isCategory(value.category)) {
    throw new InvalidReceiptAnalysisError("category is invalid.");
  }
  const category = value.category as ExpenseCategory | null;
  const notes = nullableString(value.notes, "notes");

  if (!isConfidence(value.confidence)) {
    throw new InvalidReceiptAnalysisError("confidence is invalid.");
  }

  const uncertainFields = stringArray(value.uncertainFields, "uncertainFields");
  const warnings = stringArray(value.warnings, "warnings");
  const mismatchWarning = currencyMismatchWarning(currency, jobCurrency);
  if (mismatchWarning && !warnings.includes(mismatchWarning)) warnings.push(mismatchWarning);

  return {
    vendor,
    date,
    total,
    currency,
    category,
    notes,
    confidence: value.confidence,
    uncertainFields,
    warnings,
  };
}
