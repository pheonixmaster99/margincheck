import { FirebaseError } from "firebase/app";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";
import { validateReceiptFile } from "@/lib/receipt-file";
import type { ReceiptMetadata } from "@/types/entries";

function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function receiptStoragePath(
  userId: string,
  jobId: string,
  receiptId: string,
  filename: string,
): string {
  return `users/${userId}/jobs/${jobId}/receipts/${receiptId}/${safeFilename(filename)}`;
}

export async function uploadReceipt(
  userId: string,
  jobId: string,
  file: File,
  existingReceiptId?: string,
): Promise<ReceiptMetadata> {
  const validationError = validateReceiptFile(file);
  if (validationError) throw new Error(validationError);
  const receiptId = existingReceiptId ?? crypto.randomUUID();
  const storagePath = receiptStoragePath(userId, jobId, receiptId, file.name);
  await uploadBytes(ref(getFirebaseStorage(), storagePath), file, {
    contentType: file.type,
  });
  return {
    receiptId,
    filename: file.name,
    mimeType: file.type as ReceiptMetadata["mimeType"],
    size: file.size,
    storagePath,
  };
}

export function getReceiptUrl(receipt: ReceiptMetadata): Promise<string> {
  if (!receipt.storagePath) {
    return Promise.reject(new Error("This migrated receipt file is not available in Firebase Storage."));
  }
  return getDownloadURL(ref(getFirebaseStorage(), receipt.storagePath));
}

export async function deleteReceipt(receipt: ReceiptMetadata): Promise<void> {
  if (!receipt.storagePath) return;
  try {
    await deleteObject(ref(getFirebaseStorage(), receipt.storagePath));
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "storage/object-not-found") return;
    throw error;
  }
}
