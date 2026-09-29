export interface LabourEntry {
  id: string;
  jobId: string;
  date: string;
  workerName?: string;
  hours: number;
  hourlyCost: number;
  totalCost: number;
  notes?: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = ["materials", "subcontractor", "other"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ReceiptMetadata {
  receiptId: string;
  filename: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  size: number;
}

export interface ExpenseEntry {
  id: string;
  jobId: string;
  date: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  receipt?: ReceiptMetadata;
  createdAt: string;
}
