"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LegacyMigrationCard } from "@/components/legacy-migration-card";
import { useMarginCheckData } from "@/components/margincheck-data-provider";
import { SummaryCard } from "@/components/summary-card";
import { TopNavigation } from "@/components/top-navigation";
import {
  assessJobRisk,
  calculateDashboardTotals,
  calculateJobFinancials,
  formatNumber,
  formatSignedNumber,
  getBestProfitPerLabourHourJobsByCurrency,
  type CurrencyDashboardTotals,
} from "@/lib/calculations";
import { formatCurrency, formatCurrencyWithCents } from "@/lib/currency";

function marginVarianceClass(value: number): string {
  if (value < 0) return "font-semibold text-red-500";
  return "font-semibold text-emerald-600";
}

function labourVarianceClass(value: number): string {
  if (value > 0) return "font-semibold text-red-500";
  if (value < 0) return "font-semibold text-emerald-600";
  return "font-medium text-slate-600";
}

function statusClass(status: string): string {
  if (status === "Completed") return "bg-blue-100 text-blue-700";
  if (status === "Active") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

type MonetaryTotalField = "totalQuotedRevenue" | "expectedProfit" | "currentProfit";

function MonetarySummaryCard({
  label,
  totals,
  field,
  positiveTone = false,
}: {
  label: string;
  totals: CurrencyDashboardTotals[];
  field: MonetaryTotalField;
  positiveTone?: boolean;
}) {
  if (totals.length <= 1) {
    const currencyTotal = totals[0];
    const value = currencyTotal?.[field] ?? 0;
    const currency = currencyTotal?.currency ?? "CAD";
    return (
      <SummaryCard
        label={label}
        value={formatCurrency(value, currency)}
        tone={value < 0 ? "danger" : positiveTone ? "success" : "default"}
      />
    );
  }

  return (
    <article className="min-h-[118px] rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] sm:px-6">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <div className="mt-3 grid gap-1.5">
        {totals.map((total) => {
          const value = total[field];
          const tone = value < 0 ? "text-red-500" : positiveTone ? "text-emerald-600" : "text-slate-900";
          return (
            <div key={total.currency} className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold text-slate-500">{total.currency}</span>
              <span className={`text-[17px] font-bold tracking-[-0.02em] ${tone}`}>{formatCurrency(value, total.currency)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function Dashboard() {
  const {
    jobs: storedJobs,
    labourEntries,
    expenseEntries,
    loading,
    error,
  } = useMarginCheckData();
  const jobs = useMemo(
    () => [...storedJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storedJobs],
  );
  const totals = useMemo(
    () => calculateDashboardTotals(jobs, labourEntries, expenseEntries),
    [expenseEntries, jobs, labourEntries],
  );
  const jobRows = useMemo(
    () => jobs.map((job) => {
      const jobLabourEntries = labourEntries.filter(({ jobId }) => jobId === job.id);
      const jobExpenseEntries = expenseEntries.filter(({ jobId }) => jobId === job.id);
      return {
        job,
        financials: calculateJobFinancials(job, jobLabourEntries, jobExpenseEntries),
        risk: assessJobRisk(job, jobLabourEntries, jobExpenseEntries),
      };
    }),
    [expenseEntries, jobs, labourEntries],
  );
  const needsAttention = useMemo(
    () => jobRows.filter(({ risk }) => risk.isAtRisk),
    [jobRows],
  );
  const efficientJobGroups = useMemo(
    () => getBestProfitPerLabourHourJobsByCurrency(jobs, labourEntries, expenseEntries, 5),
    [expenseEntries, jobs, labourEntries],
  );

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <TopNavigation active="dashboard" />
      <main className="w-full px-5 pb-16 pt-8 sm:px-10 lg:px-[52px]">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[30px] font-bold tracking-[-0.035em] text-slate-900">Dashboard</h1>
            <p className="mt-1.5 text-sm text-slate-600">Track job profitability and see where margins are changing.</p>
          </div>
          <Link href="/jobs/new" className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">+ New Job</Link>
        </header>

        <LegacyMigrationCard />
        {loading ? <p className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">Loading your jobs from Firebase…</p> : null}
        {error ? <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{error}</p> : null}

        <section aria-label="Portfolio summary" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Active Jobs" value={String(totals.activeJobs)} />
          <MonetarySummaryCard label="Total Quoted Revenue" totals={totals.byCurrency} field="totalQuotedRevenue" />
          <MonetarySummaryCard label="Expected Profit" totals={totals.byCurrency} field="expectedProfit" positiveTone />
          <MonetarySummaryCard label="Current / Actual Profit" totals={totals.byCurrency} field="currentProfit" />
        </section>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[16px] font-bold text-slate-900">Needs Attention</h2>
                {needsAttention.length ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">{needsAttention.length} active</span> : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">Active jobs moving materially beyond their estimates.</p>
            </div>
            {needsAttention.length ? (
              <div className="divide-y divide-slate-200">
                {needsAttention.map(({ job, financials, risk }) => (
                  <article key={job.id} className="flex items-start justify-between gap-5 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="font-semibold text-slate-900 hover:text-blue-600">{job.name}</Link>
                      <p className="mt-0.5 text-xs text-slate-500">{job.customer}</p>
                      <ul className="mt-2 grid gap-1">
                        {risk.reasons.map((reason) => <li key={reason.key} className="text-xs font-medium text-red-600">• {reason.label}</li>)}
                      </ul>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-slate-500">Current margin</p>
                      <p className="mt-1 text-lg font-bold text-red-500">{financials.actualMargin.toFixed(1)}%</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">✓</div>
                <p className="mt-3 text-sm font-semibold text-slate-800">No active jobs need attention</p>
                <p className="mt-1 text-xs text-slate-500">Jobs with enough actual data are within the current thresholds.</p>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <h2 className="text-[16px] font-bold text-slate-900">Best Profit per Labour Hour</h2>
              <p className="mt-1 text-xs text-slate-500">Completed work ranked by profit earned for each labour hour.</p>
            </div>
            {efficientJobGroups.length ? (
              <div className="divide-y divide-slate-200">
                {efficientJobGroups.map((group) => (
                  <div key={group.currency}>
                    {efficientJobGroups.length > 1 ? (
                      <div className="bg-slate-50 px-5 py-2 text-[11px] font-bold tracking-wide text-slate-500 sm:px-6">{group.currency}</div>
                    ) : null}
                    <ol className="divide-y divide-slate-200">
                      {group.jobs.map(({ job, financials }, index) => (
                        <li key={job.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="font-semibold text-slate-900 hover:text-blue-600">{job.name}</Link>
                            <p className="mt-0.5 text-xs text-slate-500">{formatNumber(financials.actualLabourHours)} labour hrs · {job.customer}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-[15px] font-bold ${financials.profitPerLabourHour < 0 ? "text-red-500" : "text-emerald-600"}`}>{formatCurrencyWithCents(financials.profitPerLabourHour, job.currency)}</p>
                            <p className="text-[10px] text-slate-500">per labour hour</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-600">↗</div>
                <p className="mt-3 text-sm font-semibold text-slate-800">No completed labour data yet</p>
                <p className="mt-1 text-xs text-slate-500">Complete a job with recorded labour to start comparing efficiency.</p>
              </div>
            )}
          </section>
        </div>

        <section id="jobs" className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <h2 className="text-[16px] font-bold text-slate-900">Jobs</h2>
            <p className="mt-1 text-xs text-slate-500">Estimated and actual performance across your work.</p>
          </div>

          {jobs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-600">
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M6 7.5h12M8.5 4h7l1 3.5h-9L8.5 4ZM5 7.5h14v12H5v-12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No jobs yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Create your first job to start tracking estimated vs actual profitability.</p>
              <Link href="/jobs/new" className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Create Job</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-[13px]">
                <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Job</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Quoted Revenue</th>
                    <th className="px-4 py-3 text-right">Expected Margin</th>
                    <th className="px-4 py-3 text-right">Current / Actual Margin</th>
                    <th className="px-4 py-3 text-right">Margin Variance</th>
                    <th className="px-4 py-3 text-right">Labour Variance</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobRows.map(({ job, financials }) => {
                    return (
                      <tr key={job.id} className="border-t border-slate-200 transition hover:bg-slate-50/70">
                        <th className="px-6 py-4 text-left font-semibold text-slate-900">{job.name}</th>
                        <td className="px-4 py-4 text-slate-600">{job.customer}</td>
                        <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(job.status)}`}>{job.status}</span></td>
                        <td className="px-4 py-4 text-right font-medium text-slate-800">{formatCurrency(job.quotedRevenue, job.currency)}</td>
                        <td className="px-4 py-4 text-right font-medium text-slate-800">{financials.expectedMargin.toFixed(1)}%</td>
                        <td className={`px-4 py-4 text-right ${financials.hasActualData ? marginVarianceClass(financials.marginVariance) : "text-slate-400"}`}>
                          {financials.hasActualData ? `${financials.actualMargin.toFixed(1)}%` : "—"}
                        </td>
                        <td className={`px-4 py-4 text-right ${financials.hasActualData ? marginVarianceClass(financials.marginVariance) : "text-slate-400"}`}>
                          {financials.hasActualData ? `${financials.marginVariance > 0 ? "+" : ""}${financials.marginVariance.toFixed(1)} pts` : "—"}
                        </td>
                        <td className={`px-4 py-4 text-right ${financials.hasLabourData ? labourVarianceClass(financials.labourHoursVariance) : "text-slate-400"}`}>
                          {financials.hasLabourData ? `${formatSignedNumber(financials.labourHoursVariance)} hrs` : "—"}
                        </td>
                        <td className="px-6 py-4 text-right"><Link href={`/jobs/${encodeURIComponent(job.id)}`} className="font-semibold text-blue-600 hover:text-blue-700">View Job</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
