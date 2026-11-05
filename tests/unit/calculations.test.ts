import assert from "node:assert/strict";
import test from "node:test";
import {
  assessJobRisk,
  calculateDashboardTotals,
  calculateJobFinancials,
  getBestProfitPerLabourHourJobsByCurrency,
} from "../../lib/calculations";
import type { ExpenseEntry, LabourEntry } from "../../types/entries";
import type { Job } from "../../types/job";

const createdAt = "2026-09-30T12:00:00.000Z";
const job: Job = {
  id: "job-1",
  ownerId: "user-a",
  name: "Smith Patio",
  customer: "John Smith",
  status: "Completed",
  currency: "CAD",
  quotedRevenue: 12000,
  estimatedLabourHours: 60,
  labourCostPerHour: 40,
  estimatedMaterials: 3000,
  estimatedSubcontractors: 1000,
  estimatedOther: 200,
  createdAt,
  updatedAt: createdAt,
};

const labour: LabourEntry[] = [{
  id: "labour-1",
  jobId: job.id,
  ownerId: job.ownerId,
  date: "2026-09-30",
  hours: 78,
  hourlyCost: 40,
  createdAt,
  updatedAt: createdAt,
}];

const expenses: ExpenseEntry[] = [
  { id: "expense-1", jobId: job.id, ownerId: job.ownerId, date: "2026-09-30", vendor: "Materials", category: "materials", amount: 3450, createdAt, updatedAt: createdAt },
  { id: "expense-2", jobId: job.id, ownerId: job.ownerId, date: "2026-09-30", vendor: "Subcontractor", category: "subcontractor", amount: 1000, createdAt, updatedAt: createdAt },
  { id: "expense-3", jobId: job.id, ownerId: job.ownerId, date: "2026-09-30", vendor: "Other", category: "other", amount: 180, createdAt, updatedAt: createdAt },
];

test("calculates estimated and actual profitability from source entries", () => {
  const financials = calculateJobFinancials(job, labour, expenses);
  assert.equal(financials.estimatedLabourCost, 2400);
  assert.equal(financials.estimatedTotalCost, 6600);
  assert.equal(financials.expectedProfit, 5400);
  assert.equal(financials.expectedMargin, 45);
  assert.equal(financials.actualLabourHours, 78);
  assert.equal(financials.actualLabourCost, 3120);
  assert.equal(financials.actualTotalCost, 7750);
  assert.equal(financials.actualProfit, 4250);
  assert.ok(Math.abs(financials.actualMargin - 35.4166666667) < 0.0001);
  assert.ok(Math.abs(financials.profitPerLabourHour - 54.4871794872) < 0.0001);
});

test("avoids divide-by-zero output", () => {
  const financials = calculateJobFinancials({ ...job, quotedRevenue: 0 }, [], []);
  assert.equal(financials.expectedMargin, 0);
  assert.equal(financials.actualMargin, 0);
  assert.equal(financials.profitPerLabourHour, 0);
});

test("keeps dashboard money grouped by currency", () => {
  const usdJob = { ...job, id: "job-usd", currency: "USD" as const };
  const totals = calculateDashboardTotals([job, usdJob]);
  assert.equal(totals.byCurrency.length, 2);
  assert.deepEqual(new Set(totals.byCurrency.map(({ currency }) => currency)), new Set(["CAD", "USD"]));
});

test("risk and efficiency rules remain deterministic", () => {
  const activeJob = { ...job, status: "Active" as const };
  const risk = assessJobRisk(activeJob, labour, expenses);
  assert.equal(risk.isAtRisk, true);
  assert.ok(risk.reasons.some(({ key }) => key === "margin"));
  assert.ok(risk.reasons.some(({ key }) => key === "labour"));
  assert.ok(risk.reasons.some(({ key }) => key === "cost"));

  const groups = getBestProfitPerLabourHourJobsByCurrency([job], labour, expenses);
  assert.equal(groups[0]?.jobs[0]?.job.id, job.id);
});
