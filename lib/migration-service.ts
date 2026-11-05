import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { getExpenseEntries, getLabourEntries } from "@/lib/entries-storage";
import { importExpenseIfMissing } from "@/lib/expenses-service";
import { getFirebaseDb } from "@/lib/firebase";
import { getJobs } from "@/lib/jobs-storage";
import { importJobIfMissing } from "@/lib/jobs-service";
import { importLabourEntryIfMissing } from "@/lib/labour-service";
import { getReceipt as getLocalReceipt } from "@/lib/receipt-storage";
import { uploadReceipt } from "@/lib/receipts-service";

const MIGRATION_ID = "local-v1";

export interface LocalMigrationSummary {
  jobs: number;
  labourEntries: number;
  expenses: number;
  receipts: number;
}

function migrationDocument(userId: string) {
  return doc(getFirebaseDb(), "users", userId, "migrations", MIGRATION_ID);
}

export function getLocalMigrationSummary(): LocalMigrationSummary {
  const jobs = getJobs();
  const labourEntries = getLabourEntries();
  const expenses = getExpenseEntries();
  return {
    jobs: jobs.length,
    labourEntries: labourEntries.length,
    expenses: expenses.length,
    receipts: expenses.filter(({ receipt }) => receipt).length,
  };
}

export async function isLocalMigrationComplete(userId: string): Promise<boolean> {
  return (await getDoc(migrationDocument(userId))).data()?.status === "complete";
}

export async function migrateLocalData(userId: string): Promise<LocalMigrationSummary> {
  if (await isLocalMigrationComplete(userId)) return getLocalMigrationSummary();

  const jobs = getJobs();
  const labourEntries = getLabourEntries();
  const expenses = getExpenseEntries();

  for (const localJob of jobs) {
    await importJobIfMissing({ ...localJob, ownerId: userId });

    for (const localLabour of labourEntries.filter(({ jobId }) => jobId === localJob.id)) {
      await importLabourEntryIfMissing({ ...localLabour, ownerId: userId });
    }

    for (const localExpense of expenses.filter(({ jobId }) => jobId === localJob.id)) {
      let receipt = localExpense.receipt;
      if (receipt && !receipt.storagePath) {
        const storedReceipt = await getLocalReceipt(receipt.receiptId);
        if (storedReceipt) {
          const file = new File([storedReceipt.blob], receipt.filename, { type: receipt.mimeType });
          receipt = await uploadReceipt(userId, localJob.id, file, receipt.receiptId);
        }
      }
      await importExpenseIfMissing({
        ...localExpense,
        ownerId: userId,
        receipt,
      });
    }
  }

  const summary = getLocalMigrationSummary();
  await setDoc(migrationDocument(userId), {
    status: "complete",
    completedAt: Timestamp.now(),
    ...summary,
  });
  return summary;
}
