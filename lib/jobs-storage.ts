import { SUPPORTED_CURRENCIES, type CurrencyCode, type Job } from "@/types/job";
import { migrateLegacyActualEntries } from "@/lib/entries-storage";

export const JOBS_STORAGE_KEY = "margincheck_jobs";
const LEGACY_JOB_KEY = "margincheck.job.v1";
const JOBS_CHANGED_EVENT = "margincheck:jobs-changed";

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeStatus(value: unknown): Job["status"] | null {
  if (value === "Active" || value === "Completed") return value;
  if (value === "Draft") return "Active";
  return null;
}

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

function normalizeJob(value: unknown): Job | null {
  if (!value || typeof value !== "object") return null;
  const job = value as Record<string, unknown>;
  const status = normalizeStatus(job.status);
  const valid =
    typeof job.id === "string" &&
    typeof job.name === "string" &&
    typeof job.customer === "string" &&
    status !== null &&
    typeof job.createdAt === "string" &&
    isNonNegativeNumber(job.quotedRevenue) &&
    isNonNegativeNumber(job.estimatedLabourHours) &&
    isNonNegativeNumber(job.labourCostPerHour) &&
    isNonNegativeNumber(job.estimatedMaterials) &&
    isNonNegativeNumber(job.estimatedSubcontractors) &&
    isNonNegativeNumber(job.estimatedOther);
  if (!valid) return null;
  return {
    ...job,
    ownerId: typeof job.ownerId === "string" ? job.ownerId : "",
    status,
    currency: isCurrency(job.currency) ? job.currency : "CAD",
    updatedAt: typeof job.updatedAt === "string" ? job.updatedAt : job.createdAt,
  } as Job;
}

interface LegacyCosts {
  labourHours: number;
  labourCost: number;
  materials: number;
  subcontractors: number;
  other: number;
}

interface LegacyJob {
  id: string;
  name: string;
  customer: string;
  status: Job["status"] | "Draft";
  quotedRevenue: number;
  estimated: LegacyCosts;
  actual: LegacyCosts;
}

function parseLegacyJob(value: string): LegacyJob | null {
  try {
    const job = JSON.parse(value) as LegacyJob;
    if (!job || typeof job !== "object" || !job.estimated || !job.actual) return null;
    if (
      typeof job.id !== "string" ||
      typeof job.name !== "string" ||
      typeof job.customer !== "string" ||
      normalizeStatus(job.status) === null ||
      !isNonNegativeNumber(job.quotedRevenue)
    ) return null;
    const costs = [...Object.values(job.estimated), ...Object.values(job.actual)];
    return costs.every(isNonNegativeNumber) ? job : null;
  } catch {
    return null;
  }
}

function migrateLegacyJob(): Job[] {
  const legacyValue = window.localStorage.getItem(LEGACY_JOB_KEY);
  if (!legacyValue) return [];
  const legacy = parseLegacyJob(legacyValue);
  if (!legacy) return [];

  const createdAt = new Date().toISOString();
  const migrated: Job = {
    id: legacy.id,
    ownerId: "",
    name: legacy.name,
    customer: legacy.customer,
    status: normalizeStatus(legacy.status) ?? "Active",
    currency: "CAD",
    quotedRevenue: legacy.quotedRevenue,
    estimatedLabourHours: legacy.estimated.labourHours,
    labourCostPerHour:
      legacy.estimated.labourHours === 0
        ? 0
        : legacy.estimated.labourCost / legacy.estimated.labourHours,
    estimatedMaterials: legacy.estimated.materials,
    estimatedSubcontractors: legacy.estimated.subcontractors,
    estimatedOther: legacy.estimated.other,
    createdAt,
    updatedAt: createdAt,
  };

  migrateLegacyActualEntries(migrated.id, legacy.actual, createdAt);
  window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify([migrated]));
  return [migrated];
}

export function parseJobsSnapshot(value: string): Job[] {
  if (!value) return [];
  try {
    const jobs = JSON.parse(value) as unknown;
    return Array.isArray(jobs)
      ? jobs.map(normalizeJob).filter((job): job is Job => job !== null)
      : [];
  } catch {
    return [];
  }
}

export function getJobs(): Job[] {
  const value = window.localStorage.getItem(JOBS_STORAGE_KEY);
  if (value === null) return migrateLegacyJob();
  return parseJobsSnapshot(value);
}

export function getJob(id: string): Job | null {
  return getJobs().find((job) => job.id === id) ?? null;
}

function writeJobs(jobs: Job[]): void {
  window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
  window.dispatchEvent(new Event(JOBS_CHANGED_EVENT));
}

export function saveJob(job: Job): void {
  const jobs = getJobs();
  const existingIndex = jobs.findIndex(({ id }) => id === job.id);
  if (existingIndex >= 0) jobs[existingIndex] = job;
  else jobs.push(job);
  writeJobs(jobs);
}

export function updateJob(job: Job): void {
  const jobs = getJobs();
  const index = jobs.findIndex(({ id }) => id === job.id);
  if (index === -1) return;
  jobs[index] = job;
  writeJobs(jobs);
}

export function getJobsSnapshot(): string {
  const value = window.localStorage.getItem(JOBS_STORAGE_KEY);
  if (value !== null) return JSON.stringify(parseJobsSnapshot(value));
  return JSON.stringify(migrateLegacyJob());
}

export function subscribeToJobs(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === JOBS_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(JOBS_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(JOBS_CHANGED_EVENT, onStoreChange);
  };
}
