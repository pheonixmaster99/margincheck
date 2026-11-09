import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { analyzeReceipt } from "../lib/server/receipt-analysis";
import {
  receiptFileValidationMessage,
  validateReceiptFileDescriptor,
  type SupportedReceiptMimeType,
} from "../lib/receipt-file";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "../types/job";

const MIME_BY_EXTENSION: Record<string, SupportedReceiptMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

async function main(): Promise<void> {
  const fileArgument = process.argv[2];
  const currencyArgument = process.argv[3] ?? "CAD";

  if (!fileArgument) {
    console.error("Usage: npm run check:receipt-analysis -- <receipt-path> [CAD|USD|EUR|GBP|AUD|NZD]");
    process.exitCode = 1;
  } else if (!SUPPORTED_CURRENCIES.includes(currencyArgument as CurrencyCode)) {
    console.error("Choose a supported job currency: CAD, USD, EUR, GBP, AUD, or NZD.");
    process.exitCode = 1;
  } else {
    const filePath = resolve(fileArgument);
    const mimeType = MIME_BY_EXTENSION[extname(filePath).toLowerCase()];
    if (!mimeType) {
      console.error("Choose a JPG, JPEG, PNG, or PDF receipt.");
      process.exitCode = 1;
    } else {
      const fileStats = await stat(filePath);
      const validationCode = validateReceiptFileDescriptor({
        mimeType,
        size: fileStats.size,
      });
      if (validationCode) {
        console.error(receiptFileValidationMessage(validationCode));
        process.exitCode = 1;
      } else {
        const bytes = await readFile(filePath);
        const analysis = await analyzeReceipt({
          filename: basename(filePath),
          mimeType,
          size: bytes.byteLength,
          bytes,
          jobCurrency: currencyArgument as CurrencyCode,
        });
        console.log(JSON.stringify(analysis, null, 2));
      }
    }
  }
}

void main();
