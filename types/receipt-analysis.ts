import type { ExpenseCategory } from "@/types/entries";
import type { CurrencyCode } from "@/types/job";

export type ReceiptAnalysisConfidence = "high" | "medium" | "low";

export interface ReceiptAnalysis {
  vendor: string | null;
  date: string | null;
  total: number | null;
  currency: CurrencyCode | null;
  category: ExpenseCategory | null;
  notes: string | null;
  confidence: ReceiptAnalysisConfidence;
  uncertainFields: string[];
  warnings: string[];
}
