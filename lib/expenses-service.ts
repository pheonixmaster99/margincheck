import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseEntry, type ReceiptMetadata } from "@/types/entries";

function entriesCollection(userId: string, jobId: string) {
  return collection(getFirebaseDb(), "users", userId, "jobs", jobId, "expenses");
}

function entryDocument(userId: string, jobId: string, entryId: string) {
  return doc(getFirebaseDb(), "users", userId, "jobs", jobId, "expenses", entryId);
}

function isCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

function receiptMetadata(value: unknown): ReceiptMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const receipt = value as Record<string, unknown>;
  if (
    typeof receipt.receiptId !== "string" ||
    typeof receipt.filename !== "string" ||
    typeof receipt.mimeType !== "string" ||
    typeof receipt.size !== "number"
  ) return undefined;
  return {
    receiptId: receipt.receiptId,
    filename: receipt.filename,
    mimeType: receipt.mimeType as ReceiptMetadata["mimeType"],
    size: receipt.size,
    storagePath: typeof receipt.storagePath === "string" ? receipt.storagePath : undefined,
  };
}

function entryFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): ExpenseEntry {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    jobId: typeof data.jobId === "string" ? data.jobId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    date: typeof data.date === "string" ? data.date : "",
    vendor: typeof data.vendor === "string" ? data.vendor : "",
    category: isCategory(data.category) ? data.category : "other",
    amount: typeof data.amount === "number" ? data.amount : 0,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    receipt: receiptMetadata(data.receipt),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
  };
}

function entryData(entry: ExpenseEntry) {
  return {
    ownerId: entry.ownerId,
    jobId: entry.jobId,
    date: entry.date,
    vendor: entry.vendor,
    category: entry.category,
    amount: entry.amount,
    notes: entry.notes,
    receipt: entry.receipt,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(entry.updatedAt)),
  };
}

export async function createExpense(entry: ExpenseEntry): Promise<void> {
  await setDoc(entryDocument(entry.ownerId, entry.jobId, entry.id), entryData(entry));
}

export async function importExpenseIfMissing(entry: ExpenseEntry): Promise<void> {
  const reference = entryDocument(entry.ownerId, entry.jobId, entry.id);
  if (!(await getDoc(reference)).exists()) await setDoc(reference, entryData(entry));
}

export async function getExpenseEntries(userId: string, jobId: string): Promise<ExpenseEntry[]> {
  const snapshot = await getDocs(query(entriesCollection(userId, jobId), orderBy("createdAt", "desc")));
  return snapshot.docs.map(entryFromSnapshot);
}

export function updateExpense(entry: ExpenseEntry): Promise<void> {
  const updated = { ...entry, updatedAt: new Date().toISOString() };
  return setDoc(entryDocument(entry.ownerId, entry.jobId, entry.id), entryData(updated));
}

export function deleteExpense(userId: string, jobId: string, entryId: string): Promise<void> {
  return deleteDoc(entryDocument(userId, jobId, entryId));
}

export function observeExpenseEntries(
  userId: string,
  jobId: string,
  onData: (entries: ExpenseEntry[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(entriesCollection(userId, jobId), orderBy("createdAt", "desc")),
    (snapshot) => onData(snapshot.docs.map(entryFromSnapshot)),
    onError,
  );
}
