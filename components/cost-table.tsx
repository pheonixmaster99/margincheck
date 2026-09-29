import { calculateCostComparisons, type JobFinancials } from "@/lib/calculations";
import { formatCurrency, formatSignedCurrency } from "@/lib/currency";
import type { ExpenseEntry, LabourEntry } from "@/types/entries";
import type { Job } from "@/types/job";

interface CostTableProps {
  job: Job;
  financials: JobFinancials;
  labourEntries: LabourEntry[];
  expenseEntries: ExpenseEntry[];
}

function varianceClass(variance: number, hasActualData = true): string {
  if (!hasActualData) return "font-medium text-slate-400";
  if (variance > 0) return "font-semibold text-red-500";
  if (variance < 0) return "font-semibold text-emerald-600";
  return "font-medium text-slate-500";
}

export function CostTable({ job, financials, labourEntries, expenseEntries }: CostTableProps) {
  const rows = calculateCostComparisons(job, labourEntries, expenseEntries);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
      <div className="border-b border-slate-200 px-5 py-[19px] sm:px-6">
        <h2 className="text-[15px] font-bold text-slate-900">Estimated vs Actual Costs</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left sm:px-6">Category</th>
              <th className="px-4 py-3 text-right">Estimated</th>
              <th className="px-4 py-3 text-right">Actual</th>
              <th className="px-5 py-3 text-right sm:px-6">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-200 first:border-t-0">
                <th className="px-5 py-[17px] text-left font-medium text-slate-800 sm:px-6">{row.label}</th>
                <td className="px-4 py-[17px] text-right text-slate-800">{formatCurrency(row.estimated, job.currency)}</td>
                <td className="px-4 py-[17px] text-right text-slate-800">{formatCurrency(row.actual, job.currency)}</td>
                <td className={`px-5 py-[17px] text-right sm:px-6 ${varianceClass(row.variance, row.hasActualData)}`}>{row.hasActualData ? formatSignedCurrency(row.variance, job.currency) : "—"}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-300 bg-slate-100">
              <th className="px-5 py-[17px] text-left font-bold text-slate-900 sm:px-6">Total</th>
              <td className="px-4 py-[17px] text-right font-bold text-slate-900">{formatCurrency(financials.estimatedTotalCost, job.currency)}</td>
              <td className="px-4 py-[17px] text-right font-bold text-slate-900">{formatCurrency(financials.actualTotalCost, job.currency)}</td>
              <td className={`px-5 py-[17px] text-right sm:px-6 ${varianceClass(financials.totalCostVariance, financials.hasActualData)}`}>{financials.hasActualData ? formatSignedCurrency(financials.totalCostVariance, job.currency) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
