"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CostTable } from "@/components/cost-table";
import { InsightCard } from "@/components/insight-card";
import { JobActivity } from "@/components/job-activity";
import { AddExpenseModal, AddLabourModal } from "@/components/job-entry-modals";
import { LabourPerformance } from "@/components/labour-performance";
import { SummaryCard } from "@/components/summary-card";
import { TopNavigation } from "@/components/top-navigation";
import { calculateJobFinancials, getCostVarianceInsight } from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import {
  getExpenseEntriesSnapshot,
  getLabourEntriesSnapshot,
  parseExpenseEntriesSnapshot,
  parseLabourEntriesSnapshot,
  subscribeToExpenseEntries,
  subscribeToLabourEntries,
} from "@/lib/entries-storage";
import { getJobsSnapshot, parseJobsSnapshot, subscribeToJobs, updateJob } from "@/lib/jobs-storage";
import type { ExpenseEntry, LabourEntry } from "@/types/entries";

const getServerSnapshot = () => "[]";

const PlusIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
    <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export function JobDetail({ jobId }: { jobId: string }) {
  const jobsSnapshot = useSyncExternalStore(subscribeToJobs, getJobsSnapshot, getServerSnapshot);
  const labourSnapshot = useSyncExternalStore(
    subscribeToLabourEntries,
    getLabourEntriesSnapshot,
    getServerSnapshot,
  );
  const expenseSnapshot = useSyncExternalStore(
    subscribeToExpenseEntries,
    getExpenseEntriesSnapshot,
    getServerSnapshot,
  );
  const [activeModal, setActiveModal] = useState<
    | { type: "labour"; entry?: LabourEntry }
    | { type: "expense"; entry?: ExpenseEntry }
    | null
  >(null);
  const job = useMemo(
    () => parseJobsSnapshot(jobsSnapshot).find(({ id }) => id === jobId) ?? null,
    [jobId, jobsSnapshot],
  );
  const labourEntries = useMemo(
    () => parseLabourEntriesSnapshot(labourSnapshot).filter(({ jobId: entryJobId }) => entryJobId === jobId),
    [jobId, labourSnapshot],
  );
  const expenseEntries = useMemo(
    () => parseExpenseEntriesSnapshot(expenseSnapshot).filter(({ jobId: entryJobId }) => entryJobId === jobId),
    [expenseSnapshot, jobId],
  );

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
        <TopNavigation active="jobs" />
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <div className="rounded-xl border border-slate-200 bg-white px-7 py-12">
            <h1 className="text-2xl font-bold">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">This job may not exist in local storage on this device.</p>
            <Link href="/dashboard#jobs" className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Back to Jobs</Link>
          </div>
        </main>
      </div>
    );
  }

  const financials = calculateJobFinancials(job, labourEntries, expenseEntries);
  const marginDifference = Math.abs(financials.marginVariance).toFixed(1);
  const marginDirection = financials.marginVariance < 0 ? "below" : "above";
  const actualMarginTone = !financials.hasActualData
    ? "default"
    : financials.marginVariance < 0
      ? "danger"
      : "success";

  const insight = getCostVarianceInsight(job, labourEntries, expenseEntries);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <TopNavigation active="jobs" />
      <main className="w-full px-5 pb-16 pt-7 sm:px-10 lg:px-[52px]">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard#jobs" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700">
            <span aria-hidden="true">←</span> All Jobs
          </Link>
          <Link href="/jobs/new" className="rounded-md bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700">New Job</Link>
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)] sm:px-7">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[29px] font-bold leading-none tracking-[-0.035em] text-slate-800">{job.name}</h1>
            <label className={`relative rounded-full px-3 py-1 text-[11px] font-semibold ${job.status === "Completed" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
              <span className="sr-only">Job status</span>
              <select
                aria-label="Job status"
                value={job.status === "Completed" ? "Completed" : "Active"}
                onChange={(event) => updateJob({ ...job, status: event.target.value as "Active" | "Completed" })}
                className="cursor-pointer appearance-none bg-transparent pr-3 font-semibold outline-none"
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">⌄</span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-y-2 text-[12px] text-slate-500">
            <span>Customer: <strong className="ml-1 font-semibold text-slate-800">{job.customer}</strong></span>
            <span className="mx-5 hidden h-4 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <span className="basis-full sm:basis-auto">Quoted Amount: <strong className="ml-1 font-semibold text-slate-800">{formatCurrency(job.quotedRevenue, job.currency)}</strong></span>
          </div>
        </section>

        <section aria-label="Job financial summary" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Expected Profit" value={formatCurrency(financials.expectedProfit, job.currency)} tone={financials.expectedProfit < 0 ? "danger" : "default"} />
          <SummaryCard
            label={job.status === "Active" ? "Current Profit" : "Actual Profit"}
            value={financials.hasActualData ? formatCurrency(financials.actualProfit, job.currency) : "Not available"}
            tone={!financials.hasActualData ? "default" : financials.actualProfit < 0 ? "danger" : "warning"}
          />
          <SummaryCard label="Expected Margin" value={`${financials.expectedMargin.toFixed(1)}%`} tone={financials.expectedMargin < 0 ? "danger" : "default"} />
          <SummaryCard
            label={job.status === "Active" ? "Current Margin" : "Actual Margin"}
            value={financials.hasActualData ? `${financials.actualMargin.toFixed(1)}%` : "Not available"}
            tone={actualMarginTone}
            detail={!financials.hasActualData ? "Waiting for actual costs" : financials.marginVariance === 0 ? "On estimate" : `${marginDifference} pts ${marginDirection} estimate`}
          />
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.78fr)_minmax(300px,1fr)]">
          <div className="min-w-0">
            <CostTable job={job} financials={financials} labourEntries={labourEntries} expenseEntries={expenseEntries} />
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setActiveModal({ type: "expense" })} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700"><PlusIcon /> Add Expense</button>
              <button type="button" onClick={() => setActiveModal({ type: "labour" })} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700"><PlusIcon /> Add Labour</button>
            </div>
          </div>
          <div className="grid gap-5">
            <InsightCard message={insight} />
            <LabourPerformance estimatedHours={job.estimatedLabourHours} actualHours={financials.actualLabourHours} hoursVariance={financials.labourHoursVariance} profitPerLabourHour={financials.profitPerLabourHour} currency={job.currency} hasLabourData={financials.hasLabourData} />
          </div>
        </div>
        <JobActivity
          job={job}
          expenses={expenseEntries}
          labour={labourEntries}
          onEditExpense={(entry) => setActiveModal({ type: "expense", entry })}
          onEditLabour={(entry) => setActiveModal({ type: "labour", entry })}
        />
      </main>
      {activeModal?.type === "labour" ? <AddLabourModal key={activeModal.entry?.id ?? "new-labour"} job={job} entry={activeModal.entry} onClose={() => setActiveModal(null)} /> : null}
      {activeModal?.type === "expense" ? <AddExpenseModal key={activeModal.entry?.id ?? "new-expense"} job={job} entry={activeModal.entry} onClose={() => setActiveModal(null)} /> : null}
    </div>
  );
}
