import type { SupportedReceiptMimeType } from "@/lib/receipt-file";
import type { CurrencyCode } from "@/types/job";
import type { ReceiptAnalysis } from "@/types/receipt-analysis";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export interface AnalyzeReceiptRequestBody {
  jobId: string;
  storagePath: string;
}

export interface AuthorizedReceiptSource {
  filename: string;
  mimeType: SupportedReceiptMimeType;
  size: number;
  bytes: Uint8Array;
  jobCurrency: CurrencyCode;
}

export interface AnalyzeReceiptDependencies {
  authenticate(request: Request): Promise<{ uid: string }>;
  loadReceipt(
    userId: string,
    jobId: string,
    storagePath: string,
  ): Promise<AuthorizedReceiptSource>;
  analyzeReceipt(source: AuthorizedReceiptSource): Promise<ReceiptAnalysis>;
}

export class ReceiptEndpointError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "ReceiptEndpointError";
  }
}

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 512
    && !value.includes("/");
}

export function parseAnalyzeReceiptRequest(value: unknown): AnalyzeReceiptRequestBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReceiptEndpointError(400, "A valid JSON request body is required.");
  }
  const body = value as Record<string, unknown>;
  if (!isSafeDocumentId(body.jobId) || typeof body.storagePath !== "string") {
    throw new ReceiptEndpointError(400, "jobId and storagePath are required.");
  }
  const storagePath = body.storagePath.trim();
  if (!storagePath || storagePath.length > 2048) {
    throw new ReceiptEndpointError(400, "The receipt storage path is invalid.");
  }
  return { jobId: body.jobId, storagePath };
}

export function validateReceiptStoragePath(
  storagePath: string,
  userId: string,
  jobId: string,
): { receiptId: string; filename: string } {
  const segments = storagePath.split("/");
  if (
    segments.length !== 7
    || segments[0] !== "users"
    || segments[2] !== "jobs"
    || segments[4] !== "receipts"
    || segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new ReceiptEndpointError(400, "The receipt storage path is invalid.");
  }
  if (segments[1] !== userId || segments[3] !== jobId) {
    throw new ReceiptEndpointError(403, "Access to this receipt is not allowed.");
  }
  return { receiptId: segments[5], filename: segments[6] };
}

function errorResponse(error: unknown): Response {
  if (error instanceof ReceiptEndpointError) {
    return Response.json(
      { error: error.publicMessage },
      { status: error.status, headers: NO_STORE_HEADERS },
    );
  }
  return Response.json(
    { error: "The receipt could not be analyzed." },
    { status: 500, headers: NO_STORE_HEADERS },
  );
}

export function createAnalyzeReceiptHandler(
  dependencies: AnalyzeReceiptDependencies,
): (request: Request) => Promise<Response> {
  return async function analyzeReceiptHandler(request: Request): Promise<Response> {
    try {
      const user = await dependencies.authenticate(request);
      let bodyValue: unknown;
      try {
        bodyValue = await request.json();
      } catch {
        throw new ReceiptEndpointError(400, "A valid JSON request body is required.");
      }
      const body = parseAnalyzeReceiptRequest(bodyValue);
      validateReceiptStoragePath(body.storagePath, user.uid, body.jobId);

      const receipt = await dependencies.loadReceipt(user.uid, body.jobId, body.storagePath);
      const analysis = await dependencies.analyzeReceipt(receipt);

      return Response.json(
        {
          analysis,
          receipt: {
            filename: receipt.filename,
            mimeType: receipt.mimeType,
            size: receipt.size,
          },
          job: {
            id: body.jobId,
            currency: receipt.jobCurrency,
          },
        },
        { headers: NO_STORE_HEADERS },
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}
