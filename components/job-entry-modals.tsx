"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ReceiptAttachmentField } from "@/components/receipt-attachment-field";
import { calculateLabourEntryTotal } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import {
  saveExpenseEntry,
  saveLabourEntry,
  updateExpenseEntry,
  updateLabourEntry,
} from "@/lib/entries-storage";
import { deleteReceipt, saveReceipt } from "@/lib/receipt-storage";
import type { ExpenseCategory, ExpenseEntry, LabourEntry } from "@/types/entries";
import type { Job } from "@/types/job";

function today(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numericValue(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function ModalShell({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-[1px]">
      <section role="dialog" aria-modal="true" aria-labelledby="entry-modal-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id="entry-modal-title" className="text-xl font-bold tracking-[-0.02em] text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100";
const labelClass = "mb-2 block text-[13px] font-semibold text-slate-700";

export function AddLabourModal({ job, entry, onClose }: { job: Job; entry?: LabourEntry; onClose: () => void }) {
  const [date, setDate] = useState(() => entry?.date ?? today());
  const [workerName, setWorkerName] = useState(entry?.workerName ?? "");
  const [hours, setHours] = useState(entry ? String(entry.hours) : "");
  const [hourlyCost, setHourlyCost] = useState(entry ? String(entry.hourlyCost) : "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    date: date ? "" : "Date is required.",
    hours: numericValue(hours) > 0 ? "" : "Hours worked must be greater than 0.",
    hourlyCost:
      hourlyCost !== "" && numericValue(hourlyCost) >= 0
        ? ""
        : "Labour cost per hour must be 0 or more.",
  };
  const totalCost = useMemo(
    () => calculateLabourEntryTotal(Math.max(0, numericValue(hours)), Math.max(0, numericValue(hourlyCost))),
    [hours, hourlyCost],
  );
  const isValid = !errors.date && !errors.hours && !errors.hourlyCost;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;
    const savedEntry: LabourEntry = {
      id: entry?.id ?? crypto.randomUUID(),
      jobId: job.id,
      date,
      workerName: workerName.trim() || undefined,
      hours: numericValue(hours),
      hourlyCost: numericValue(hourlyCost),
      totalCost,
      notes: notes.trim() || undefined,
      createdAt: entry?.createdAt ?? new Date().toISOString(),
    };
    if (entry) updateLabourEntry(savedEntry);
    else saveLabourEntry(savedEntry);
    onClose();
  }

  return (
    <ModalShell title={entry ? "Edit labour" : "Add labour"} description={`${entry ? "Update" : "Record"} labour activity for ${job.name}.`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div>
            <label htmlFor="labour-date" className={labelClass}>Date</label>
            <input id="labour-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
            {submitted && errors.date ? <p className="mt-1.5 text-xs text-red-600">{errors.date}</p> : null}
          </div>
          <div>
            <label htmlFor="worker-name" className={labelClass}>Worker name <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="worker-name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} placeholder="e.g. Sam Lee" className={inputClass} />
          </div>
          <div>
            <label htmlFor="hours-worked" className={labelClass}>Hours worked</label>
            <div className="relative"><input id="hours-worked" type="number" min="0" step="any" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" className={`${inputClass} pr-14`} /><span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-slate-500">hrs</span></div>
            {submitted && errors.hours ? <p className="mt-1.5 text-xs text-red-600">{errors.hours}</p> : null}
          </div>
          <div>
            <label htmlFor="actual-hourly-cost" className={labelClass}>Labour cost per hour</label>
            <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-500">{getCurrencySymbol(job.currency)}</span><input id="actual-hourly-cost" type="number" min="0" step="any" inputMode="decimal" value={hourlyCost} onChange={(event) => setHourlyCost(event.target.value)} placeholder="0.00" className={`${inputClass} pl-10 pr-14`} /><span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-slate-500">/ hr</span></div>
            {submitted && errors.hourlyCost ? <p className="mt-1.5 text-xs text-red-600">{errors.hourlyCost}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="labour-notes" className={labelClass}>Notes <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea id="labour-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="What work was completed?" className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
            <span className="text-sm font-medium text-slate-600">Total labour cost</span>
            <strong className="text-xl text-slate-900">{formatCurrency(totalCost, job.currency)}</strong>
          </div>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">{entry ? "Update Labour" : "Save Labour"}</button>
        </footer>
      </form>
    </ModalShell>
  );
}

export function AddExpenseModal({ job, entry, onClose }: { job: Job; entry?: ExpenseEntry; onClose: () => void }) {
  const [date, setDate] = useState(() => entry?.date ?? today());
  const [vendor, setVendor] = useState(entry?.vendor ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(entry?.category ?? "materials");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [selectedReceipt, setSelectedReceipt] = useState<File | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [storageError, setStorageError] = useState("");

  const errors = {
    date: date ? "" : "Date is required.",
    vendor: vendor.trim() ? "" : "Vendor is required.",
    amount: numericValue(amount) > 0 ? "" : "Amount must be greater than 0.",
  };
  const isValid = !errors.date && !errors.vendor && !errors.amount;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;
    setIsSaving(true);
    setStorageError("");
    let uploadedReceiptId: string | undefined;
    let expenseSaved = false;

    try {
      const uploadedReceipt = selectedReceipt ? await saveReceipt(selectedReceipt) : undefined;
      uploadedReceiptId = uploadedReceipt?.receiptId;
      const nextReceipt = uploadedReceipt ?? (removeExistingReceipt ? undefined : entry?.receipt);
      const savedEntry: ExpenseEntry = {
        id: entry?.id ?? crypto.randomUUID(),
        jobId: job.id,
        date,
        vendor: vendor.trim(),
        category,
        amount: numericValue(amount),
        notes: notes.trim() || undefined,
        receipt: nextReceipt,
        createdAt: entry?.createdAt ?? new Date().toISOString(),
      };
      if (entry) updateExpenseEntry(savedEntry);
      else saveExpenseEntry(savedEntry);
      expenseSaved = true;

      if (entry?.receipt && entry.receipt.receiptId !== nextReceipt?.receiptId) {
        await deleteReceipt(entry.receipt.receiptId);
      }
      onClose();
    } catch (error) {
      if (uploadedReceiptId && !expenseSaved) {
        try { await deleteReceipt(uploadedReceiptId); } catch { /* Best-effort rollback. */ }
      }
      setStorageError(error instanceof Error ? error.message : "The receipt could not be saved. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title={entry ? "Edit expense" : "Add expense"} description={`${entry ? "Update" : "Record"} an actual cost for ${job.name}.`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div>
            <label htmlFor="expense-date" className={labelClass}>Date</label>
            <input id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
            {submitted && errors.date ? <p className="mt-1.5 text-xs text-red-600">{errors.date}</p> : null}
          </div>
          <div>
            <label htmlFor="vendor" className={labelClass}>Vendor</label>
            <input id="vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="e.g. Home Hardware" className={inputClass} />
            {submitted && errors.vendor ? <p className="mt-1.5 text-xs text-red-600">{errors.vendor}</p> : null}
          </div>
          <div>
            <label htmlFor="expense-category" className={labelClass}>Category</label>
            <select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} className={inputClass}>
              <option value="materials">Materials</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="expense-amount" className={labelClass}>Amount</label>
            <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-500">{getCurrencySymbol(job.currency)}</span><input id="expense-amount" type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className={`${inputClass} pl-10`} /></div>
            {submitted && errors.amount ? <p className="mt-1.5 text-xs text-red-600">{errors.amount}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="expense-notes" className={labelClass}>Notes <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea id="expense-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add any useful context." className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100" />
          </div>
          <ReceiptAttachmentField
            existingReceipt={removeExistingReceipt ? undefined : entry?.receipt}
            selectedFile={selectedReceipt}
            onSelect={(file) => {
              setSelectedReceipt(file);
              setRemoveExistingReceipt(false);
              setStorageError("");
            }}
            onRemove={() => {
              setSelectedReceipt(null);
              setRemoveExistingReceipt(true);
            }}
          />
          <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
            <span className="text-sm font-medium text-slate-600">Expense total</span>
            <strong className="text-xl text-slate-900">{formatCurrency(Math.max(0, numericValue(amount)), job.currency)}</strong>
          </div>
          {storageError ? <p role="alert" className="sm:col-span-2 text-xs font-medium text-red-600">{storageError}</p> : null}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving…" : entry ? "Update Expense" : "Save Expense"}</button>
        </footer>
      </form>
    </ModalShell>
  );
}
