import type { ExpenseCategory, ExpenseEntry, LabourEntry } from "@/types/entries";
import type { CurrencyCode, Job } from "@/types/job";
import { formatCurrency } from "@/lib/currency";

export type CostCategory = "labour" | "materials" | "subcontractors" | "other";

export interface CostComparison {
  key: CostCategory;
  label: string;
  estimated: number;
  actual: number;
  variance: number;
  hasActualData: boolean;
}

export interface JobFinancials {
  estimatedLabourCost: number;
  estimatedTotalCost: number;
  actualLabourHours: number;
  actualLabourCost: number;
  actualMaterials: number;
  actualSubcontractors: number;
  actualOther: number;
  actualTotalCost: number;
  expectedProfit: number;
  actualProfit: number;
  expectedMargin: number;
  actualMargin: number;
  marginVariance: number;
  totalCostVariance: number;
  labourHoursVariance: number;
  profitPerLabourHour: number;
  hasLabourData: boolean;
  hasActualData: boolean;
}

export interface CurrencyDashboardTotals {
  currency: CurrencyCode;
  totalQuotedRevenue: number;
  expectedProfit: number;
  currentProfit: number;
}

export interface DashboardTotals {
  activeJobs: number;
  byCurrency: CurrencyDashboardTotals[];
}

export const JOB_RISK_THRESHOLDS = {
  marginBelowEstimatePoints: 5,
  labourHoursOverEstimateRatio: 0.1,
} as const;

export type JobRiskReasonKey = "margin" | "labour" | "cost";

export interface JobRiskReason {
  key: JobRiskReasonKey;
  label: string;
}

export interface JobRiskAssessment {
  isAtRisk: boolean;
  reasons: JobRiskReason[];
}

export interface EfficientJobResult {
  job: Job;
  financials: JobFinancials;
}

export interface EfficientJobsCurrencyGroup {
  currency: CurrencyCode;
  jobs: EfficientJobResult[];
}

export function calculateLabourEntryTotal(hours: number, hourlyCost: number): number {
  return hours * hourlyCost;
}

export function calculateEstimatedLabourCost(job: Job): number {
  return job.estimatedLabourHours * job.labourCostPerHour;
}

function sumExpenseCategory(entries: ExpenseEntry[], category: ExpenseCategory): number {
  return entries.reduce(
    (total, entry) => total + (entry.category === category ? entry.amount : 0),
    0,
  );
}

export function calculateCostComparisons(
  job: Job,
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
): CostComparison[] {
  const actualLabourCost = labourEntries.reduce((total, entry) => total + entry.totalCost, 0);
  const actualMaterials = sumExpenseCategory(expenseEntries, "materials");
  const actualSubcontractors = sumExpenseCategory(expenseEntries, "subcontractor");
  const actualOther = sumExpenseCategory(expenseEntries, "other");
  const values: Array<[CostCategory, string, number, number, boolean]> = [
    ["labour", "Labour", calculateEstimatedLabourCost(job), actualLabourCost, labourEntries.length > 0],
    ["materials", "Materials", job.estimatedMaterials, actualMaterials, expenseEntries.some(({ category }) => category === "materials")],
    ["subcontractors", "Subcontractors", job.estimatedSubcontractors, actualSubcontractors, expenseEntries.some(({ category }) => category === "subcontractor")],
    ["other", "Other", job.estimatedOther, actualOther, expenseEntries.some(({ category }) => category === "other")],
  ];

  return values.map(([key, label, estimated, actual, hasActualData]) => ({
    key,
    label,
    estimated,
    actual,
    variance: actual - estimated,
    hasActualData,
  }));
}

export function calculateJobFinancials(
  job: Job,
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
): JobFinancials {
  const estimatedLabourCost = calculateEstimatedLabourCost(job);
  const estimatedTotalCost =
    estimatedLabourCost +
    job.estimatedMaterials +
    job.estimatedSubcontractors +
    job.estimatedOther;
  const actualLabourHours = labourEntries.reduce((total, entry) => total + entry.hours, 0);
  const actualLabourCost = labourEntries.reduce((total, entry) => total + entry.totalCost, 0);
  const actualMaterials = sumExpenseCategory(expenseEntries, "materials");
  const actualSubcontractors = sumExpenseCategory(expenseEntries, "subcontractor");
  const actualOther = sumExpenseCategory(expenseEntries, "other");
  const actualTotalCost = actualLabourCost + actualMaterials + actualSubcontractors + actualOther;
  const expectedProfit = job.quotedRevenue - estimatedTotalCost;
  const actualProfit = job.quotedRevenue - actualTotalCost;
  const expectedMargin = job.quotedRevenue === 0 ? 0 : (expectedProfit / job.quotedRevenue) * 100;
  const actualMargin = job.quotedRevenue === 0 ? 0 : (actualProfit / job.quotedRevenue) * 100;

  return {
    estimatedLabourCost,
    estimatedTotalCost,
    actualLabourHours,
    actualLabourCost,
    actualMaterials,
    actualSubcontractors,
    actualOther,
    actualTotalCost,
    expectedProfit,
    actualProfit,
    expectedMargin,
    actualMargin,
    marginVariance: actualMargin - expectedMargin,
    totalCostVariance: actualTotalCost - estimatedTotalCost,
    labourHoursVariance: actualLabourHours - job.estimatedLabourHours,
    profitPerLabourHour: actualLabourHours === 0 ? 0 : actualProfit / actualLabourHours,
    hasLabourData: labourEntries.length > 0,
    hasActualData: labourEntries.length > 0 || expenseEntries.length > 0,
  };
}

export function calculateDashboardTotals(
  jobs: Job[],
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
): DashboardTotals {
  const grouped = new Map<CurrencyCode, CurrencyDashboardTotals>();
  let activeJobs = 0;

  for (const job of jobs) {
    const jobLabour = labourEntries.filter(({ jobId }) => jobId === job.id);
    const jobExpenses = expenseEntries.filter(({ jobId }) => jobId === job.id);
    const financials = calculateJobFinancials(job, jobLabour, jobExpenses);
    if (job.status === "Active") activeJobs += 1;
    const totals = grouped.get(job.currency) ?? {
      currency: job.currency,
      totalQuotedRevenue: 0,
      expectedProfit: 0,
      currentProfit: 0,
    };
    totals.totalQuotedRevenue += job.quotedRevenue;
    totals.expectedProfit += financials.expectedProfit;
    totals.currentProfit += financials.hasActualData ? financials.actualProfit : 0;
    grouped.set(job.currency, totals);
  }

  return { activeJobs, byCurrency: Array.from(grouped.values()) };
}

export function assessJobRisk(
  job: Job,
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
): JobRiskAssessment {
  if (job.status !== "Active") return { isAtRisk: false, reasons: [] };

  const financials = calculateJobFinancials(job, labourEntries, expenseEntries);
  const reasons: JobRiskReason[] = [];

  if (
    financials.hasActualData &&
    financials.marginVariance < -JOB_RISK_THRESHOLDS.marginBelowEstimatePoints
  ) {
    reasons.push({
      key: "margin",
      label: `Margin is ${Math.abs(financials.marginVariance).toFixed(1)} pts below estimate`,
    });
  }

  const labourLimit = job.estimatedLabourHours *
    (1 + JOB_RISK_THRESHOLDS.labourHoursOverEstimateRatio);
  if (
    financials.hasLabourData &&
    financials.actualLabourHours > labourLimit
  ) {
    const overagePercent = job.estimatedLabourHours === 0
      ? null
      : ((financials.actualLabourHours - job.estimatedLabourHours) / job.estimatedLabourHours) * 100;
    reasons.push({
      key: "labour",
      label: overagePercent === null
        ? "Labour hours were recorded without an estimate"
        : `Labour hours are ${overagePercent.toFixed(0)}% over estimate`,
    });
  }

  if (
    financials.hasActualData &&
    financials.actualTotalCost > financials.estimatedTotalCost
  ) {
    reasons.push({
      key: "cost",
      label: `Actual costs are ${formatCurrency(financials.totalCostVariance, job.currency)} over estimate`,
    });
  }

  return { isAtRisk: reasons.length > 0, reasons };
}

export function getBestProfitPerLabourHourJobs(
  jobs: Job[],
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
  limit = 5,
): EfficientJobResult[] {
  return jobs
    .filter(({ status }) => status === "Completed")
    .map((job) => {
      const jobLabour = labourEntries.filter(({ jobId }) => jobId === job.id);
      const jobExpenses = expenseEntries.filter(({ jobId }) => jobId === job.id);
      return { job, financials: calculateJobFinancials(job, jobLabour, jobExpenses) };
    })
    .filter(({ financials }) => financials.actualLabourHours > 0)
    .sort((a, b) => b.financials.profitPerLabourHour - a.financials.profitPerLabourHour)
    .slice(0, Math.max(0, limit));
}

export function getBestProfitPerLabourHourJobsByCurrency(
  jobs: Job[],
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
  limitPerCurrency = 5,
): EfficientJobsCurrencyGroup[] {
  const currencies = Array.from(new Set(jobs.map(({ currency }) => currency)));

  return currencies
    .map((currency) => ({
      currency,
      jobs: getBestProfitPerLabourHourJobs(
        jobs.filter((job) => job.currency === currency),
        labourEntries,
        expenseEntries,
        limitPerCurrency,
      ),
    }))
    .filter(({ jobs: rankedJobs }) => rankedJobs.length > 0);
}

export function getCostVarianceInsight(
  job: Job,
  labourEntries: LabourEntry[] = [],
  expenseEntries: ExpenseEntry[] = [],
): string {
  const financials = calculateJobFinancials(job, labourEntries, expenseEntries);
  if (!financials.hasActualData) return "No actual costs have been recorded yet.";

  const overruns = calculateCostComparisons(job, labourEntries, expenseEntries)
    .filter(({ variance, hasActualData }) => hasActualData && variance > 0)
    .sort((a, b) => b.variance - a.variance);

  if (financials.totalCostVariance > 0 && overruns.length > 0) {
    const [largest, second] = overruns;
    const twoDriversAreSignificant =
      second !== undefined &&
      second.variance >= financials.totalCostVariance * 0.2 &&
      largest.variance + second.variance >= financials.totalCostVariance * 0.6;

    if (twoDriversAreSignificant) {
      return `${largest.label} and ${second.label.toLowerCase()} account for most of the ${formatCurrency(financials.totalCostVariance, job.currency)} cost overrun.`;
    }

    return `${largest.label} is the largest cost overrun at ${formatCurrency(largest.variance, job.currency)} above estimate.`;
  }

  if (financials.totalCostVariance < 0) {
    const timing = job.status === "Completed" ? "" : " so far";
    return `Actual costs are ${formatCurrency(Math.abs(financials.totalCostVariance), job.currency)} below estimate${timing}.`;
  }

  return "Actual costs are tracking to estimate.";
}

export function formatSignedNumber(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 2,
  }).format(value);
}
