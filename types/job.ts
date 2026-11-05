export const SUPPORTED_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "NZD"] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export type JobStatus = "Active" | "Completed";

export interface Job {
  id: string;
  ownerId: string;
  name: string;
  customer: string;
  status: JobStatus;
  currency: CurrencyCode;
  quotedRevenue: number;
  estimatedLabourHours: number;
  labourCostPerHour: number;
  estimatedMaterials: number;
  estimatedSubcontractors: number;
  estimatedOther: number;
  createdAt: string;
  updatedAt: string;
}
