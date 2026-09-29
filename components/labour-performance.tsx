import { formatNumber, formatSignedNumber } from "@/lib/calculations";
import { formatCurrencyWithCents } from "@/lib/currency";
import type { CurrencyCode } from "@/types/job";

interface LabourPerformanceProps {
  estimatedHours: number;
  actualHours: number;
  hoursVariance: number;
  profitPerLabourHour: number;
  currency: CurrencyCode;
  hasLabourData: boolean;
}

export function LabourPerformance({ estimatedHours, actualHours, hoursVariance, profitPerLabourHour, currency, hasLabourData }: LabourPerformanceProps) {
  const rows = [
    { label: "Estimated Hours", value: `${formatNumber(estimatedHours)} hrs` },
    { label: "Actual Hours", value: `${formatNumber(actualHours)} hrs` },
  ];
  const varianceClass = !hasLabourData
    ? "text-[14px] font-semibold text-slate-400"
    : hoursVariance > 0
      ? "rounded-md bg-red-50 px-2 py-1 text-[12px] font-semibold text-red-500"
      : hoursVariance < 0
        ? "rounded-md bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-600"
        : "text-[14px] font-semibold text-slate-600";
  const profitClass = !hasLabourData
    ? "text-[14px] font-semibold text-slate-400"
    : profitPerLabourHour < 0
      ? "text-[16px] font-bold text-red-500"
      : profitPerLabourHour > 0
        ? "text-[16px] font-bold text-emerald-600"
        : "text-[16px] font-bold text-slate-600";
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
      <div className="border-b border-slate-200 px-5 py-[19px] sm:px-6">
        <h2 className="text-[15px] font-bold text-slate-900">Labour Performance</h2>
      </div>
      <dl className="px-5 sm:px-6">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-slate-200 py-[18px]">
            <dt className="text-[12px] text-slate-500">{row.label}</dt>
            <dd className="text-[14px] font-semibold text-slate-900">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-b border-slate-200 py-[18px]">
          <dt className="text-[12px] text-slate-500">Variance</dt>
          <dd className={varianceClass}>{hasLabourData ? `${formatSignedNumber(hoursVariance)} hrs` : "—"}</dd>
        </div>
        <div className="flex items-center justify-between py-[20px]">
          <dt className="text-[12px] text-slate-500">Profit per Labour Hour</dt>
          <dd className={profitClass}>{hasLabourData ? formatCurrencyWithCents(profitPerLabourHour, currency) : "Not available"}</dd>
        </div>
      </dl>
    </section>
  );
}
