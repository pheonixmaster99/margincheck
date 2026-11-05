import {
  collection,
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
import { SUPPORTED_CURRENCIES, type CurrencyCode, type Job, type JobStatus } from "@/types/job";

function jobsCollection(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "jobs");
}

function jobDocument(userId: string, jobId: string) {
  return doc(getFirebaseDb(), "users", userId, "jobs", jobId);
}

function timestampToIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : new Date(0).toISOString();
}

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

function isStatus(value: unknown): value is JobStatus {
  return value === "Active" || value === "Completed";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function jobFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData> | Awaited<ReturnType<typeof getDoc>>): Job {
  const data = (snapshot.data() ?? {}) as DocumentData;
  return {
    id: snapshot.id,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    name: typeof data.name === "string" ? data.name : "",
    customer: typeof data.customer === "string" ? data.customer : "",
    status: isStatus(data.status) ? data.status : "Active",
    currency: isCurrency(data.currency) ? data.currency : "CAD",
    quotedRevenue: numberValue(data.quotedRevenue),
    estimatedLabourHours: numberValue(data.estimatedLabourHours),
    labourCostPerHour: numberValue(data.labourCostPerHour),
    estimatedMaterials: numberValue(data.estimatedMaterials),
    estimatedSubcontractors: numberValue(data.estimatedSubcontractors),
    estimatedOther: numberValue(data.estimatedOther),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function jobData(job: Job) {
  return {
    ownerId: job.ownerId,
    name: job.name,
    customer: job.customer,
    status: job.status,
    currency: job.currency,
    quotedRevenue: job.quotedRevenue,
    estimatedLabourHours: job.estimatedLabourHours,
    labourCostPerHour: job.labourCostPerHour,
    estimatedMaterials: job.estimatedMaterials,
    estimatedSubcontractors: job.estimatedSubcontractors,
    estimatedOther: job.estimatedOther,
    createdAt: Timestamp.fromDate(new Date(job.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(job.updatedAt)),
  };
}

export async function createJob(job: Job): Promise<void> {
  await setDoc(jobDocument(job.ownerId, job.id), jobData(job));
}

export async function importJobIfMissing(job: Job): Promise<void> {
  const reference = jobDocument(job.ownerId, job.id);
  if (!(await getDoc(reference)).exists()) await setDoc(reference, jobData(job));
}

export async function getJobs(userId: string): Promise<Job[]> {
  const snapshot = await getDocs(query(jobsCollection(userId), orderBy("createdAt", "desc")));
  return snapshot.docs.map(jobFromSnapshot);
}

export async function getJob(userId: string, jobId: string): Promise<Job | null> {
  const snapshot = await getDoc(jobDocument(userId, jobId));
  return snapshot.exists() ? jobFromSnapshot(snapshot) : null;
}

export async function updateJob(job: Job): Promise<void> {
  const updatedJob = { ...job, updatedAt: new Date().toISOString() };
  await setDoc(jobDocument(job.ownerId, job.id), jobData(updatedJob));
}

export function observeJobs(
  userId: string,
  onData: (jobs: Job[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(jobsCollection(userId), orderBy("createdAt", "desc")),
    (snapshot) => onData(snapshot.docs.map(jobFromSnapshot)),
    onError,
  );
}
