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
import type { LabourEntry } from "@/types/entries";

function entriesCollection(userId: string, jobId: string) {
  return collection(getFirebaseDb(), "users", userId, "jobs", jobId, "labourEntries");
}

function entryDocument(userId: string, jobId: string, entryId: string) {
  return doc(getFirebaseDb(), "users", userId, "jobs", jobId, "labourEntries", entryId);
}

function entryFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): LabourEntry {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    jobId: typeof data.jobId === "string" ? data.jobId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    date: typeof data.date === "string" ? data.date : "",
    workerName: typeof data.workerName === "string" ? data.workerName : undefined,
    hours: typeof data.hours === "number" ? data.hours : 0,
    hourlyCost: typeof data.hourlyCost === "number" ? data.hourlyCost : 0,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
  };
}

function entryData(entry: LabourEntry) {
  return {
    ownerId: entry.ownerId,
    jobId: entry.jobId,
    date: entry.date,
    workerName: entry.workerName,
    hours: entry.hours,
    hourlyCost: entry.hourlyCost,
    notes: entry.notes,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(entry.updatedAt)),
  };
}

export async function createLabourEntry(entry: LabourEntry): Promise<void> {
  await setDoc(entryDocument(entry.ownerId, entry.jobId, entry.id), entryData(entry));
}

export async function importLabourEntryIfMissing(entry: LabourEntry): Promise<void> {
  const reference = entryDocument(entry.ownerId, entry.jobId, entry.id);
  if (!(await getDoc(reference)).exists()) await setDoc(reference, entryData(entry));
}

export async function getLabourEntries(userId: string, jobId: string): Promise<LabourEntry[]> {
  const snapshot = await getDocs(query(entriesCollection(userId, jobId), orderBy("createdAt", "desc")));
  return snapshot.docs.map(entryFromSnapshot);
}

export function updateLabourEntry(entry: LabourEntry): Promise<void> {
  const updated = { ...entry, updatedAt: new Date().toISOString() };
  return setDoc(entryDocument(entry.ownerId, entry.jobId, entry.id), entryData(updated));
}

export function deleteLabourEntry(userId: string, jobId: string, entryId: string): Promise<void> {
  return deleteDoc(entryDocument(userId, jobId, entryId));
}

export function observeLabourEntries(
  userId: string,
  jobId: string,
  onData: (entries: LabourEntry[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(entriesCollection(userId, jobId), orderBy("createdAt", "desc")),
    (snapshot) => onData(snapshot.docs.map(entryFromSnapshot)),
    onError,
  );
}
