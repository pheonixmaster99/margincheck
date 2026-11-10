import { getFirebaseAuth } from "@/lib/firebase";
import { parseReceiptAnalysis } from "@/lib/receipt-analysis";
import { isSupportedReceiptMimeType } from "@/lib/receipt-file";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/types/job";
import type { ReceiptAnalysisResult } from "@/types/receipt-analysis";

export type ReceiptAnalysisServiceErrorCode =
  | "authentication-required"
  | "invalid-request"
  | "forbidden"
  | "not-found"
  | "too-large"
  | "unsupported-type"
  | "rate-limited"
  | "extraction-failed"
  | "service-unavailable"
  | "network-error"
  | "invalid-response"
  | "unexpected-error";

export class ReceiptAnalysisServiceError extends Error {
  constructor(
    public readonly code: ReceiptAnalysisServiceErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ReceiptAnalysisServiceError";
  }
}

export interface AnalyzeStoredReceiptInput {
  jobId: string;
  storagePath: string;
  signal?: AbortSignal;
}

export interface ReceiptAnalysisClientDependencies {
  getIdToken(): Promise<string | null>;
  fetcher: typeof fetch;
}

const defaultDependencies: ReceiptAnalysisClientDependencies = {
  async getIdToken() {
    const user = getFirebaseAuth().currentUser;
    return user ? user.getIdToken() : null;
  },
  fetcher: (...arguments_) => fetch(...arguments_),
};

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string"
    && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

function requestError(status: number): ReceiptAnalysisServiceError {
  switch (status) {
    case 400:
      return new ReceiptAnalysisServiceError(
        "invalid-request",
        "The receipt analysis request is invalid. Select the receipt again and retry.",
        status,
      );
    case 401:
      return new ReceiptAnalysisServiceError(
        "authentication-required",
        "Your session has expired. Sign in again to analyze this receipt.",
        status,
      );
    case 403:
      return new ReceiptAnalysisServiceError(
        "forbidden",
        "You do not have access to analyze this receipt.",
        status,
      );
    case 404:
      return new ReceiptAnalysisServiceError(
        "not-found",
        "The receipt is no longer available. Attach it again and retry.",
        status,
      );
    case 413:
      return new ReceiptAnalysisServiceError(
        "too-large",
        "This receipt is larger than 10 MB.",
        status,
      );
    case 415:
      return new ReceiptAnalysisServiceError(
        "unsupported-type",
        "Use a JPG, PNG, or PDF receipt.",
        status,
      );
    case 429:
      return new ReceiptAnalysisServiceError(
        "rate-limited",
        "Receipt analysis is temporarily busy. Try again shortly.",
        status,
      );
    case 502:
      return new ReceiptAnalysisServiceError(
        "extraction-failed",
        "The receipt could not be read. Enter the expense manually or retry.",
        status,
      );
    case 503:
      return new ReceiptAnalysisServiceError(
        "service-unavailable",
        "Receipt analysis is temporarily unavailable.",
        status,
      );
    default:
      return new ReceiptAnalysisServiceError(
        "unexpected-error",
        "The receipt could not be analyzed. Try again.",
        status,
      );
  }
}

function parseResult(value: unknown, expectedJobId: string): ReceiptAnalysisResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }
  const response = value as Record<string, unknown>;
  if (!response.job || typeof response.job !== "object" || Array.isArray(response.job)) {
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }
  const job = response.job as Record<string, unknown>;
  if (job.id !== expectedJobId || !isCurrency(job.currency)) {
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }

  if (
    !response.receipt
    || typeof response.receipt !== "object"
    || Array.isArray(response.receipt)
  ) {
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }
  const receipt = response.receipt as Record<string, unknown>;
  if (
    typeof receipt.filename !== "string"
    || !isSupportedReceiptMimeType(receipt.mimeType)
    || typeof receipt.size !== "number"
    || !Number.isFinite(receipt.size)
    || receipt.size < 0
  ) {
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }

  try {
    return {
      analysis: parseReceiptAnalysis(response.analysis, job.currency),
      receipt: {
        filename: receipt.filename,
        mimeType: receipt.mimeType,
        size: receipt.size,
      },
      job: {
        id: job.id,
        currency: job.currency,
      },
    };
  } catch (error) {
    if (error instanceof ReceiptAnalysisServiceError) throw error;
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }
}

export async function analyzeStoredReceipt(
  { jobId, storagePath, signal }: AnalyzeStoredReceiptInput,
  dependencies: ReceiptAnalysisClientDependencies = defaultDependencies,
): Promise<ReceiptAnalysisResult> {
  if (!jobId.trim() || !storagePath.trim()) {
    throw new ReceiptAnalysisServiceError(
      "invalid-request",
      "A job and stored receipt are required for analysis.",
    );
  }

  let idToken: string | null;
  try {
    idToken = await dependencies.getIdToken();
  } catch {
    throw new ReceiptAnalysisServiceError(
      "authentication-required",
      "Your session could not be verified. Sign in again and retry.",
    );
  }
  if (!idToken) {
    throw new ReceiptAnalysisServiceError(
      "authentication-required",
      "Sign in to analyze this receipt.",
    );
  }

  let response: Response;
  try {
    response = await dependencies.fetcher("/api/ai/receipts/analyze", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId, storagePath }),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ReceiptAnalysisServiceError(
      "network-error",
      "Could not connect to receipt analysis. Check your connection and retry.",
    );
  }

  if (!response.ok) throw requestError(response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ReceiptAnalysisServiceError(
      "invalid-response",
      "Receipt analysis returned an invalid response. Try again.",
    );
  }
  return parseResult(payload, jobId);
}
