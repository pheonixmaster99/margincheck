export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type SupportedReceiptMimeType = (typeof SUPPORTED_RECEIPT_TYPES)[number];

export type ReceiptFileValidationCode =
  | "invalid-size"
  | "too-large"
  | "unsupported-type";

export interface ReceiptFileDescriptor {
  mimeType: string;
  size: number;
}

export function isSupportedReceiptMimeType(value: unknown): value is SupportedReceiptMimeType {
  return typeof value === "string"
    && SUPPORTED_RECEIPT_TYPES.includes(value as SupportedReceiptMimeType);
}

export function validateReceiptFileDescriptor({
  mimeType,
  size,
}: ReceiptFileDescriptor): ReceiptFileValidationCode | null {
  if (!isSupportedReceiptMimeType(mimeType)) return "unsupported-type";
  if (!Number.isFinite(size) || size < 0) return "invalid-size";
  if (size > MAX_RECEIPT_SIZE_BYTES) return "too-large";
  return null;
}

export function receiptFileValidationMessage(code: ReceiptFileValidationCode): string {
  if (code === "unsupported-type") return "Choose a JPG, JPEG, PNG, or PDF file.";
  if (code === "too-large") return "Receipt files must be 10 MB or smaller.";
  return "The receipt file size is invalid.";
}

export function validateReceiptFile(file: Pick<File, "size" | "type">): string | null {
  const code = validateReceiptFileDescriptor({ mimeType: file.type, size: file.size });
  return code ? receiptFileValidationMessage(code) : null;
}
