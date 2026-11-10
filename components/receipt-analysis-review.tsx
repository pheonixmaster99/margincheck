"use client";

import { formatCurrencyWithCents } from "@/lib/currency";
import type { ReceiptMetadata } from "@/types/entries";
import type { CurrencyCode } from "@/types/job";
import type {
  ReceiptAnalysis,
  ReceiptAnalysisResult,
} from "@/types/receipt-analysis";
import type { ReceiptAnalysisPhase } from "@/components/use-receipt-analysis-lifecycle";

const FIELD_LABELS: Record<string, string> = {
  vendor: "Vendor",
  date: "Date",
  total: "Amount",
  currency: "Currency",
  category: "Category",
  notes: "Notes",
};

const CATEGORY_LABELS: Record<NonNullable<ReceiptAnalysis["category"]>, string> = {
  materials: "Materials",
  subcontractor: "Subcontractor",
  other: "Other",
};

const CONFIDENCE_STYLES: Record<ReceiptAnalysis["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};

function displayValue(value: string | null): string {
  return value?.trim() || "Not detected";
}

function fieldIsUncertain(analysis: ReceiptAnalysis, field: string): boolean {
  return analysis.uncertainFields.some(
    (uncertainField) => uncertainField.toLowerCase() === field.toLowerCase(),
  );
}

function SuggestionField({
  label,
  value,
  uncertain,
}: {
  label: string;
  value: string;
  uncertain: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${uncertain ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {uncertain ? <span className="text-[10px] font-semibold text-amber-700">Check this</span> : null}
      </div>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ProgressState({ phase }: { phase: "uploading" | "analyzing" }) {
  const isUploading = phase === "uploading";
  return (
    <div role="status" aria-live="polite" className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      <div>
        <p className="text-sm font-semibold text-blue-950">{isUploading ? "Uploading receipt…" : "Analyzing receipt…"}</p>
        <p className="mt-0.5 text-xs text-blue-700">{isUploading ? "Securing the file before analysis." : "Looking for the vendor, date, total, and category."}</p>
      </div>
    </div>
  );
}

export function ReceiptAnalysisReview({
  phase,
  result,
  analysisError,
  temporaryReceipt,
  jobCurrency,
  onRetry,
  onApply,
  disabled = false,
}: {
  phase: ReceiptAnalysisPhase;
  result: ReceiptAnalysisResult | null;
  analysisError: string | null;
  temporaryReceipt: ReceiptMetadata | null;
  jobCurrency: CurrencyCode;
  onRetry: () => void;
  onApply: (analysis: ReceiptAnalysis) => void;
  disabled?: boolean;
}) {
  if (phase === "uploading" || phase === "analyzing") {
    return <ProgressState phase={phase} />;
  }

  if (phase === "error" && temporaryReceipt && analysisError) {
    return (
      <div role="alert" className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
        <p className="text-sm font-semibold text-red-900">Receipt analysis did not finish</p>
        <p className="mt-1 text-xs leading-5 text-red-700">{analysisError}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-red-700">You can retry or continue entering the expense manually.</span>
          <button type="button" onClick={onRetry} disabled={disabled} className="h-8 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
            Retry analysis
          </button>
        </div>
      </div>
    );
  }

  if (phase !== "ready" || !result) return null;

  const { analysis } = result;
  const analysisCurrency = analysis.currency ?? jobCurrency;
  const amount = analysis.total === null
    ? "Not detected"
    : formatCurrencyWithCents(analysis.total, analysisCurrency);
  const category = analysis.category
    ? CATEGORY_LABELS[analysis.category]
    : "Not detected";
  const uncertainLabels = analysis.uncertainFields.map(
    (field) => FIELD_LABELS[field.toLowerCase()] ?? field,
  );

  return (
    <section aria-labelledby="receipt-analysis-title" className="sm:col-span-2 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/50">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 px-4 py-3.5">
        <div>
          <h3 id="receipt-analysis-title" className="text-sm font-bold text-slate-900">Review receipt suggestions</h3>
          <p className="mt-0.5 text-xs text-slate-600">Nothing changes until you apply these suggestions.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${CONFIDENCE_STYLES[analysis.confidence]}`}>
          {analysis.confidence} confidence
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <SuggestionField label="Vendor" value={displayValue(analysis.vendor)} uncertain={fieldIsUncertain(analysis, "vendor")} />
          <SuggestionField label="Date" value={displayValue(analysis.date)} uncertain={fieldIsUncertain(analysis, "date")} />
          <SuggestionField label="Amount" value={amount} uncertain={fieldIsUncertain(analysis, "total")} />
          <SuggestionField label="Category" value={category} uncertain={fieldIsUncertain(analysis, "category")} />
          <SuggestionField label="Receipt currency" value={analysis.currency ?? "Not detected"} uncertain={fieldIsUncertain(analysis, "currency")} />
          <SuggestionField label="Suggested notes" value={displayValue(analysis.notes)} uncertain={fieldIsUncertain(analysis, "notes")} />
        </div>

        {uncertainLabels.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <strong>Check carefully:</strong> {uncertainLabels.join(", ")}
          </div>
        ) : null}

        {analysis.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-900">Warnings</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-800">
              {analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-3">
          <p className="text-[11px] leading-4 text-slate-500">Applying fills detected fields. You can still edit everything before saving.</p>
          <button type="button" onClick={() => onApply(analysis)} disabled={disabled} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            Apply suggestions
          </button>
        </div>
      </div>
    </section>
  );
}
