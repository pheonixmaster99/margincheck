import type { ReceiptMetadata } from "@/types/entries";
import {
  MAX_RECEIPT_SIZE_BYTES,
  SUPPORTED_RECEIPT_TYPES,
  type SupportedReceiptMimeType,
  validateReceiptFile,
} from "@/lib/receipt-file";

export {
  MAX_RECEIPT_SIZE_BYTES,
  SUPPORTED_RECEIPT_TYPES,
  validateReceiptFile,
};
export type { SupportedReceiptMimeType };

const DATABASE_NAME = "margincheck_receipts";
const DATABASE_VERSION = 1;
const RECEIPT_STORE = "receipts";

export interface StoredReceipt extends ReceiptMetadata {
  blob: Blob;
  createdAt: string;
}

function openReceiptDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open receipt storage."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECEIPT_STORE)) {
        database.createObjectStore(RECEIPT_STORE, { keyPath: "receiptId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openReceiptDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(RECEIPT_STORE, mode);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Receipt storage operation failed."));
    };
    operation(transaction.objectStore(RECEIPT_STORE), resolve, reject);
  }));
}

export async function saveReceipt(file: File): Promise<ReceiptMetadata> {
  const validationError = validateReceiptFile(file);
  if (validationError) throw new Error(validationError);

  const receipt: StoredReceipt = {
    receiptId: crypto.randomUUID(),
    filename: file.name,
    mimeType: file.type as SupportedReceiptMimeType,
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  };

  await runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(receipt);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const { blob: _blob, createdAt: _createdAt, ...metadata } = receipt;
  void _blob;
  void _createdAt;
  return metadata;
}

export async function getReceipt(receiptId: string): Promise<StoredReceipt | null> {
  return runTransaction<StoredReceipt | null>("readonly", (store, resolve, reject) => {
    const request = store.get(receiptId);
    request.onsuccess = () => resolve((request.result as StoredReceipt | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  await runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(receiptId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
