import assert from "node:assert/strict";
import test from "node:test";
import { applyReceiptAnalysisSuggestions } from "../../lib/receipt-analysis-form";
import type { ExpenseFormDraft } from "../../lib/receipt-analysis-form";
import type { ReceiptAnalysis } from "../../types/receipt-analysis";

const existingDraft: ExpenseFormDraft = {
  date: "2026-11-01",
  vendor: "Manual vendor",
  category: "other",
  amount: "25.00",
  notes: "Manual notes",
};

function analysis(overrides: Partial<ReceiptAnalysis> = {}): ReceiptAnalysis {
  return {
    vendor: "Builders Choice Hardware",
    date: "2026-11-04",
    total: 905.13,
    currency: "CAD",
    category: "materials",
    notes: "Paving materials",
    confidence: "high",
    uncertainFields: [],
    warnings: [],
    ...overrides,
  };
}

test("explicitly applying receipt suggestions fills detected expense fields", () => {
  const result = applyReceiptAnalysisSuggestions(existingDraft, analysis());

  assert.deepEqual(result, {
    date: "2026-11-04",
    vendor: "Builders Choice Hardware",
    category: "materials",
    amount: "905.13",
    notes: "Paving materials",
  });
  assert.deepEqual(existingDraft, {
    date: "2026-11-01",
    vendor: "Manual vendor",
    category: "other",
    amount: "25.00",
    notes: "Manual notes",
  });
});

test("missing receipt suggestions preserve the user's current values", () => {
  const result = applyReceiptAnalysisSuggestions(existingDraft, analysis({
    vendor: null,
    date: null,
    total: null,
    category: null,
    notes: null,
  }));

  assert.deepEqual(result, existingDraft);
  assert.notEqual(result, existingDraft);
});
