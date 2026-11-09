import "server-only";

import { validateReceiptStoragePath, ReceiptEndpointError } from "@/lib/receipt-analysis-endpoint";
import {
  receiptFileValidationMessage,
  validateReceiptFileDescriptor,
  type SupportedReceiptMimeType,
} from "@/lib/receipt-file";
import {
  getFirebaseAdminBucket,
  getFirebaseAdminFirestore,
} from "@/lib/server/firebase-admin";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/types/job";

interface AuthorizedReceiptSource {
  filename: string;
  mimeType: SupportedReceiptMimeType;
  size: number;
  bytes: Uint8Array;
  jobCurrency: CurrencyCode;
}

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string"
    && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

function isMissingFirebaseObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  return candidate.code === 404 || candidate.statusCode === 404;
}

function validateMetadata(contentType: unknown, rawSize: unknown): {
  mimeType: SupportedReceiptMimeType;
  size: number;
} {
  const mimeType = typeof contentType === "string" ? contentType : "";
  const size = typeof rawSize === "number" ? rawSize : Number(rawSize);
  const validationCode = validateReceiptFileDescriptor({ mimeType, size });
  if (validationCode === "too-large") {
    throw new ReceiptEndpointError(413, receiptFileValidationMessage(validationCode));
  }
  if (validationCode === "unsupported-type") {
    throw new ReceiptEndpointError(415, receiptFileValidationMessage(validationCode));
  }
  if (validationCode) {
    throw new ReceiptEndpointError(400, receiptFileValidationMessage(validationCode));
  }
  return { mimeType: mimeType as SupportedReceiptMimeType, size };
}

export async function loadAuthorizedReceipt(
  userId: string,
  jobId: string,
  storagePath: string,
): Promise<AuthorizedReceiptSource> {
  const { filename } = validateReceiptStoragePath(storagePath, userId, jobId);
  const jobSnapshot = await getFirebaseAdminFirestore()
    .doc(`users/${userId}/jobs/${jobId}`)
    .get();
  if (!jobSnapshot.exists) {
    throw new ReceiptEndpointError(404, "The job or receipt was not found.");
  }

  const job = jobSnapshot.data() ?? {};
  if (typeof job.ownerId === "string" && job.ownerId !== userId) {
    throw new ReceiptEndpointError(403, "Access to this receipt is not allowed.");
  }
  const jobCurrency = isCurrency(job.currency) ? job.currency : "CAD";
  const file = getFirebaseAdminBucket().file(storagePath);

  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (error) {
    if (isMissingFirebaseObjectError(error)) {
      throw new ReceiptEndpointError(404, "The job or receipt was not found.");
    }
    throw error;
  }
  const { mimeType, size } = validateMetadata(metadata.contentType, metadata.size);

  let bytes: Buffer;
  try {
    [bytes] = await file.download();
  } catch (error) {
    if (isMissingFirebaseObjectError(error)) {
      throw new ReceiptEndpointError(404, "The job or receipt was not found.");
    }
    throw error;
  }
  const downloadedValidation = validateReceiptFileDescriptor({
    mimeType,
    size: bytes.byteLength,
  });
  if (downloadedValidation === "too-large") {
    throw new ReceiptEndpointError(413, receiptFileValidationMessage(downloadedValidation));
  }
  if (downloadedValidation) {
    throw new ReceiptEndpointError(400, receiptFileValidationMessage(downloadedValidation));
  }

  return { filename, mimeType, size, bytes, jobCurrency };
}
