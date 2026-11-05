import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPENSE_ENTRIES_STORAGE_KEY,
  LABOUR_ENTRIES_STORAGE_KEY,
  migrateLegacyActualEntries,
} from "../../lib/entries-storage";
import { getJobs } from "../../lib/jobs-storage";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("legacy actual-entry migration is idempotent", () => {
  const localStorage = new MemoryStorage();
  Object.assign(globalThis, {
    window: { localStorage, dispatchEvent: () => undefined },
  });
  const actual = {
    labourHours: 78,
    labourCost: 3120,
    materials: 3450,
    subcontractors: 1000,
    other: 180,
  };
  const createdAt = "2026-09-30T12:00:00.000Z";
  migrateLegacyActualEntries("legacy-job", actual, createdAt);
  migrateLegacyActualEntries("legacy-job", actual, createdAt);

  const labour = JSON.parse(localStorage.getItem(LABOUR_ENTRIES_STORAGE_KEY) ?? "[]");
  const expenses = JSON.parse(localStorage.getItem(EXPENSE_ENTRIES_STORAGE_KEY) ?? "[]");
  const total = labour.reduce((sum: number, entry: { hours: number; hourlyCost: number }) => sum + entry.hours * entry.hourlyCost, 0)
    + expenses.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0);
  assert.equal(labour.length, 1);
  assert.equal(expenses.length, 3);
  assert.equal(total, 7750);
});

test("legacy job conversion preserves the original browser record", () => {
  const localStorage = new MemoryStorage();
  Object.assign(globalThis, {
    window: { localStorage, dispatchEvent: () => undefined },
  });
  const legacyKey = "margincheck.job.v1";
  const legacyJob = JSON.stringify({
    id: "legacy-job",
    name: "Legacy Job",
    customer: "Legacy Customer",
    status: "Active",
    quotedRevenue: 1000,
    estimated: { labourHours: 5, labourCost: 200, materials: 100, subcontractors: 0, other: 0 },
    actual: { labourHours: 0, labourCost: 0, materials: 0, subcontractors: 0, other: 0 },
  });
  localStorage.setItem(legacyKey, legacyJob);

  const jobs = getJobs();

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.id, "legacy-job");
  assert.equal(localStorage.getItem(legacyKey), legacyJob);
});
