"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { calculateLabourEntryTotal, formatNumber } from "@/lib/calculations";
import { formatCurrencyWithCents } from "@/lib/currency";
import { deleteExpense } from "@/lib/expenses-service";
import { deleteLabourEntry } from "@/lib/labour-service";
import { deleteReceipt, getReceiptUrl } from "@/lib/receipts-service";
import type { ExpenseEntry, LabourEntry, ReceiptMetadata } from "@/types/entries";
import type { Job } from "@/types/job";

type ActivityTab = "expenses" | "labour";
type DeleteTarget =
  | { type: "expense"; entry: ExpenseEntry }
  | { type: "labour"; entry: LabourEntry };

const categoryLabels: Record<ExpenseEntry["category"], string> = {
  materials: "Materials",
  subcontractor: "Subcontractor",
  other: "Other",
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function newestFirst<T extends { date: string; createdAt: string }>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onEdit} className="font-semibold text-blue-600 hover:text-blue-700">Edit</button>
      <button type="button" onClick={onDelete} className="font-semibold text-red-500 hover:text-red-600">Delete</button>
    </div>
  );
}

export function JobActivity({
  job,
  expenses,
  labour,
  onEditExpense,
  onEditLabour,
}: {
  job: Job;
  expenses: ExpenseEntry[];
  labour: LabourEntry[];
  onEditExpense: (entry: ExpenseEntry) => void;
  onEditLabour: (entry: LabourEntry) => void;
}) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("expenses");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [viewedReceipt, setViewedReceipt] = useState<ReceiptMetadata | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const sortedExpenses = useMemo(() => newestFirst(expenses), [expenses]);
  const sortedLabour = useMemo(() => newestFirst(labour), [labour]);

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "expense") {
        if (deleteTarget.entry.receipt) await deleteReceipt(deleteTarget.entry.receipt);
        await deleteExpense(job.ownerId, job.id, deleteTarget.entry.id);
      } else {
        await deleteLabourEntry(job.ownerId, job.id, deleteTarget.entry.id);
      }
      setDeleteTarget(null);
    } catch {
      setDeleteError("This entry could not be deleted. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 pt-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="pb-4">
            <h2 className="text-[16px] font-bold text-slate-900">Job Activity</h2>
            <p className="mt-1 text-xs text-slate-500">The entries that make up this job&apos;s actual costs.</p>
          </div>
          <div role="tablist" aria-label="Job activity type" className="flex gap-6">
            {(["expenses", "labour"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 pb-4 text-[13px] font-semibold capitalize transition ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {tab} <span className="ml-1 text-[11px] text-slate-400">({tab === "expenses" ? expenses.length : labour.length})</span>
              </button>
            ))}
          </div>
        </div>

        {activeTab === "expenses" ? (
          sortedExpenses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] border-collapse text-[13px]">
                <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Receipt</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExpenses.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-200">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatDate(entry.date)}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{entry.vendor}</td>
                      <td className="px-4 py-4 text-slate-600">{categoryLabels[entry.category]}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-900">{formatCurrencyWithCents(entry.amount, job.currency)}</td>
                      <td className="px-4 py-4">
                        {entry.receipt ? (
                          <button type="button" onClick={() => setViewedReceipt(entry.receipt ?? null)} className="whitespace-nowrap font-semibold text-blue-600 hover:text-blue-700">View receipt</button>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="max-w-[260px] px-4 py-4 text-slate-600">{entry.notes ?? "—"}</td>
                      <td className="px-6 py-4 text-right"><ActionButtons onEdit={() => onEditExpense(entry)} onDelete={() => setDeleteTarget({ type: "expense", entry })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyActivity label="expenses" />
        ) : sortedLabour.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-[13px]">
              <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Worker</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Cost / Hour</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedLabour.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-200">
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatDate(entry.date)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{entry.workerName ?? "—"}</td>
                    <td className="px-4 py-4 text-right text-slate-700">{formatNumber(entry.hours)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">{formatCurrencyWithCents(entry.hourlyCost, job.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-900">{formatCurrencyWithCents(calculateLabourEntryTotal(entry.hours, entry.hourlyCost), job.currency)}</td>
                    <td className="max-w-[240px] px-4 py-4 text-slate-600">{entry.notes ?? "—"}</td>
                    <td className="px-6 py-4 text-right"><ActionButtons onEdit={() => onEditLabour(entry)} onDelete={() => setDeleteTarget({ type: "labour", entry })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyActivity label="labour entries" />}
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-[1px]">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 id="delete-title" className="text-lg font-bold text-slate-900">Delete this {deleteTarget.type}?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">This will update the job&apos;s actual costs and margin. This action cannot be undone.</p>
            {deleteError ? <p role="alert" className="mt-3 text-xs font-medium text-red-600">{deleteError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={isDeleting} className="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{isDeleting ? "Deleting…" : `Delete ${deleteTarget.type === "expense" ? "Expense" : "Labour"}`}</button>
            </div>
          </section>
        </div>
      ) : null}
      {viewedReceipt ? <ReceiptViewer receipt={viewedReceipt} onClose={() => setViewedReceipt(null)} /> : null}
    </>
  );
}

function ReceiptViewer({ receipt, onClose }: { receipt: ReceiptMetadata; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getReceiptUrl(receipt)
      .then((downloadUrl) => {
        if (cancelled) return;
        setUrl(downloadUrl);
      })
      .catch(() => {
        if (!cancelled) setError("The receipt could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [receipt]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 px-4 py-8 backdrop-blur-[1px]">
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-viewer-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="receipt-viewer-title" className="truncate text-lg font-bold text-slate-900">{receipt.filename}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Stored securely with this job</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close receipt" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
        </header>
        <div className="min-h-[360px] flex-1 overflow-auto bg-slate-100 p-4 sm:p-6">
          {error ? (
            <div className="grid h-full min-h-[320px] place-items-center text-center text-sm font-medium text-red-600">{error}</div>
          ) : !url ? (
            <div className="grid h-full min-h-[320px] place-items-center text-sm text-slate-500">Loading receipt…</div>
          ) : receipt.mimeType === "application/pdf" ? (
            <iframe src={url} title={receipt.filename} className="h-[68vh] min-h-[480px] w-full rounded-lg border border-slate-200 bg-white" />
          ) : (
            <Image
              src={url}
              alt={`Receipt ${receipt.filename}`}
              width={1200}
              height={1600}
              unoptimized
              className="mx-auto h-auto max-h-[68vh] w-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
            />
          )}
        </div>
        {url && receipt.mimeType === "application/pdf" ? (
          <footer className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
            <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open PDF in a new tab</a>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function EmptyActivity({ label }: { label: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-800">No {label} recorded yet</p>
      <p className="mt-1 text-xs text-slate-500">Use the action buttons above to add the first entry.</p>
    </div>
  );
}
