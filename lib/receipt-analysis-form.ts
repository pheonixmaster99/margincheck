import type { ExpenseCategory } from "@/types/entries";
import type { ReceiptAnalysis } from "@/types/receipt-analysis";

export interface ExpenseFormDraft {
  date: string;
  vendor: string;
  category: ExpenseCategory;
  amount: string;
  notes: string;
}

export function applyReceiptAnalysisSuggestions(
  current: ExpenseFormDraft,
  analysis: ReceiptAnalysis,
): ExpenseFormDraft {
  return {
    date: analysis.date ?? current.date,
    vendor: analysis.vendor ?? current.vendor,
    category: analysis.category ?? current.category,
    amount: analysis.total === null ? current.amount : String(analysis.total),
    notes: analysis.notes ?? current.notes,
  };
}
