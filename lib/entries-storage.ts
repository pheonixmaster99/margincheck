import { calculateLabourEntryTotal } from "@/lib/calculations";
import { deleteReceipt } from "@/lib/receipt-storage";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseEntry, type LabourEntry, type ReceiptMetadata } from "@/types/entries";

export const LABOUR_ENTRIES_STORAGE_KEY = "margincheck_labour_entries";
export const EXPENSE_ENTRIES_STORAGE_KEY = "margincheck_expense_entries";
const LABOUR_CHANGED_EVENT = "margincheck:labour-entries-changed";
const EXPENSE_CHANGED_EVENT = "margincheck:expense-entries-changed";

interface LegacyActualCosts {
  labourHours: number;
  labourCost: number;
  materials: number;
  subcontractors: number;
  other: number;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isNonNegativeNumber(value) && value > 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeLabourEntry(value: unknown): LabourEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.jobId !== "string" ||
    typeof entry.date !== "string" ||
    typeof entry.createdAt !== "string" ||
    !isPositiveNumber(entry.hours) ||
    !isNonNegativeNumber(entry.hourlyCost)
  ) return null;

  return {
    id: entry.id,
    jobId: entry.jobId,
    date: entry.date,
    hours: entry.hours,
    hourlyCost: entry.hourlyCost,
    totalCost: calculateLabourEntryTotal(entry.hours, entry.hourlyCost),
    workerName: optionalString(entry.workerName),
    notes: optionalString(entry.notes),
    createdAt: entry.createdAt,
  };
}

function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

function normalizeReceiptMetadata(value: unknown): ReceiptMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const receipt = value as Record<string, unknown>;
  const supportedMimeType =
    receipt.mimeType === "image/jpeg" ||
    receipt.mimeType === "image/png" ||
    receipt.mimeType === "application/pdf";
  if (
    typeof receipt.receiptId !== "string" ||
    typeof receipt.filename !== "string" ||
    !receipt.filename.trim() ||
    !supportedMimeType ||
    !isNonNegativeNumber(receipt.size)
  ) return undefined;
  return {
    receiptId: receipt.receiptId,
    filename: receipt.filename.trim(),
    mimeType: receipt.mimeType as ReceiptMetadata["mimeType"],
    size: receipt.size,
  };
}

function normalizeExpenseEntry(value: unknown): ExpenseEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.jobId !== "string" ||
    typeof entry.date !== "string" ||
    typeof entry.vendor !== "string" ||
    !entry.vendor.trim() ||
    !isExpenseCategory(entry.category) ||
    !isPositiveNumber(entry.amount) ||
    typeof entry.createdAt !== "string"
  ) return null;

  return {
    id: entry.id,
    jobId: entry.jobId,
    date: entry.date,
    vendor: entry.vendor.trim(),
    category: entry.category,
    amount: entry.amount,
    notes: optionalString(entry.notes),
    receipt: normalizeReceiptMetadata(entry.receipt),
    createdAt: entry.createdAt,
  };
}

export function parseLabourEntriesSnapshot(value: string): LabourEntry[] {
  if (!value) return [];
  try {
    const entries = JSON.parse(value) as unknown;
    return Array.isArray(entries)
      ? entries.map(normalizeLabourEntry).filter((entry): entry is LabourEntry => entry !== null)
      : [];
  } catch {
    return [];
  }
}

export function parseExpenseEntriesSnapshot(value: string): ExpenseEntry[] {
  if (!value) return [];
  try {
    const entries = JSON.parse(value) as unknown;
    return Array.isArray(entries)
      ? entries.map(normalizeExpenseEntry).filter((entry): entry is ExpenseEntry => entry !== null)
      : [];
  } catch {
    return [];
  }
}

export function getLabourEntries(jobId?: string): LabourEntry[] {
  const entries = parseLabourEntriesSnapshot(
    window.localStorage.getItem(LABOUR_ENTRIES_STORAGE_KEY) ?? "[]",
  );
  return jobId ? entries.filter((entry) => entry.jobId === jobId) : entries;
}

export function getExpenseEntries(jobId?: string): ExpenseEntry[] {
  const entries = parseExpenseEntriesSnapshot(
    window.localStorage.getItem(EXPENSE_ENTRIES_STORAGE_KEY) ?? "[]",
  );
  return jobId ? entries.filter((entry) => entry.jobId === jobId) : entries;
}

function localDateFromIso(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function upsertById<T extends { id: string }>(entries: T[], entry: T): void {
  const index = entries.findIndex(({ id }) => id === entry.id);
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);
}

export function migrateLegacyActualEntries(
  jobId: string,
  actual: LegacyActualCosts,
  createdAt: string,
): void {
  const date = localDateFromIso(createdAt);
  const note = "Migrated from the earlier MarginCheck job format.";
  const labourEntries = getLabourEntries();
  const expenseEntries = getExpenseEntries();

  if (actual.labourHours > 0) {
    const hourlyCost = actual.labourCost / actual.labourHours;
    upsertById(labourEntries, {
      id: `${jobId}-legacy-actual-labour`,
      jobId,
      date,
      workerName: "Legacy labour",
      hours: actual.labourHours,
      hourlyCost,
      totalCost: calculateLabourEntryTotal(actual.labourHours, hourlyCost),
      notes: note,
      createdAt,
    });
  } else if (actual.labourCost > 0) {
    upsertById(expenseEntries, {
      id: `${jobId}-legacy-actual-labour-cost`,
      jobId,
      date,
      vendor: "Legacy labour cost",
      category: "other",
      amount: actual.labourCost,
      notes: `${note} Labour hours were unavailable, so this amount is retained under Other.`,
      createdAt,
    });
  }

  const legacyExpenses: Array<{
    suffix: string;
    vendor: string;
    category: ExpenseCategory;
    amount: number;
  }> = [
    { suffix: "materials", vendor: "Legacy materials", category: "materials", amount: actual.materials },
    { suffix: "subcontractors", vendor: "Legacy subcontractors", category: "subcontractor", amount: actual.subcontractors },
    { suffix: "other", vendor: "Legacy other costs", category: "other", amount: actual.other },
  ];

  for (const legacyExpense of legacyExpenses) {
    if (legacyExpense.amount <= 0) continue;
    upsertById(expenseEntries, {
      id: `${jobId}-legacy-actual-${legacyExpense.suffix}`,
      jobId,
      date,
      vendor: legacyExpense.vendor,
      category: legacyExpense.category,
      amount: legacyExpense.amount,
      notes: note,
      createdAt,
    });
  }

  if (actual.labourHours > 0) {
    window.localStorage.setItem(LABOUR_ENTRIES_STORAGE_KEY, JSON.stringify(labourEntries));
  }
  if (
    (actual.labourHours === 0 && actual.labourCost > 0) ||
    legacyExpenses.some(({ amount }) => amount > 0)
  ) {
    window.localStorage.setItem(EXPENSE_ENTRIES_STORAGE_KEY, JSON.stringify(expenseEntries));
  }
}

export function saveLabourEntry(entry: LabourEntry): void {
  const normalized = normalizeLabourEntry(entry);
  if (!normalized) return;
  const entries = getLabourEntries();
  const index = entries.findIndex(({ id }) => id === normalized.id);
  if (index >= 0) entries[index] = normalized;
  else entries.push(normalized);
  window.localStorage.setItem(LABOUR_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(LABOUR_CHANGED_EVENT));
}

export function updateLabourEntry(entry: LabourEntry): void {
  const normalized = normalizeLabourEntry(entry);
  if (!normalized) return;
  const entries = getLabourEntries();
  const index = entries.findIndex(({ id }) => id === normalized.id);
  if (index === -1) return;
  entries[index] = normalized;
  window.localStorage.setItem(LABOUR_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(LABOUR_CHANGED_EVENT));
}

export function deleteLabourEntry(id: string): void {
  const entries = getLabourEntries().filter((entry) => entry.id !== id);
  window.localStorage.setItem(LABOUR_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(LABOUR_CHANGED_EVENT));
}

export function saveExpenseEntry(entry: ExpenseEntry): void {
  const normalized = normalizeExpenseEntry(entry);
  if (!normalized) return;
  const entries = getExpenseEntries();
  const index = entries.findIndex(({ id }) => id === normalized.id);
  if (index >= 0) entries[index] = normalized;
  else entries.push(normalized);
  window.localStorage.setItem(EXPENSE_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(EXPENSE_CHANGED_EVENT));
}

export function updateExpenseEntry(entry: ExpenseEntry): void {
  const normalized = normalizeExpenseEntry(entry);
  if (!normalized) return;
  const entries = getExpenseEntries();
  const index = entries.findIndex(({ id }) => id === normalized.id);
  if (index === -1) return;
  entries[index] = normalized;
  window.localStorage.setItem(EXPENSE_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(EXPENSE_CHANGED_EVENT));
}

export async function deleteExpenseEntry(id: string): Promise<void> {
  const currentEntries = getExpenseEntries();
  const deletedEntry = currentEntries.find((entry) => entry.id === id);
  if (deletedEntry?.receipt) await deleteReceipt(deletedEntry.receipt.receiptId);
  const remainingEntries = currentEntries.filter((entry) => entry.id !== id);
  window.localStorage.setItem(EXPENSE_ENTRIES_STORAGE_KEY, JSON.stringify(remainingEntries));
  window.dispatchEvent(new Event(EXPENSE_CHANGED_EVENT));
}

export function getLabourEntriesSnapshot(): string {
  return JSON.stringify(getLabourEntries());
}

export function getExpenseEntriesSnapshot(): string {
  return JSON.stringify(getExpenseEntries());
}

export function subscribeToLabourEntries(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LABOUR_ENTRIES_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LABOUR_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LABOUR_CHANGED_EVENT, onStoreChange);
  };
}

export function subscribeToExpenseEntries(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === EXPENSE_ENTRIES_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(EXPENSE_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EXPENSE_CHANGED_EVENT, onStoreChange);
  };
}
