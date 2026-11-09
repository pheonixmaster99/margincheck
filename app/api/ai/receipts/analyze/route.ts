import { createAnalyzeReceiptHandler, ReceiptEndpointError } from "@/lib/receipt-analysis-endpoint";
import { FirebaseAuthenticationError, requireFirebaseUser } from "@/lib/server/auth";
import { ServerConfigurationError } from "@/lib/server/errors";
import { analyzeReceipt } from "@/lib/server/receipt-analysis";
import { loadAuthorizedReceipt } from "@/lib/server/receipt-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 429 || candidate.code === "rate_limit_exceeded";
}

export const POST = createAnalyzeReceiptHandler({
  async authenticate(request) {
    try {
      const user = await requireFirebaseUser(request);
      return { uid: user.uid };
    } catch (error) {
      if (error instanceof FirebaseAuthenticationError) {
        throw new ReceiptEndpointError(401, "Authentication required.");
      }
      if (error instanceof ServerConfigurationError) {
        throw new ReceiptEndpointError(503, "The receipt analysis service is not configured.");
      }
      throw error;
    }
  },
  async loadReceipt(userId, jobId, storagePath) {
    try {
      return await loadAuthorizedReceipt(userId, jobId, storagePath);
    } catch (error) {
      if (error instanceof ReceiptEndpointError) throw error;
      if (error instanceof ServerConfigurationError) {
        throw new ReceiptEndpointError(503, "The receipt analysis service is not configured.");
      }
      throw error;
    }
  },
  async analyzeReceipt(source) {
    try {
      return await analyzeReceipt(source);
    } catch (error) {
      if (error instanceof ServerConfigurationError) {
        throw new ReceiptEndpointError(503, "The receipt analysis service is not configured.");
      }
      if (isRateLimitError(error)) {
        throw new ReceiptEndpointError(429, "Receipt analysis is temporarily rate limited. Try again shortly.");
      }
      throw new ReceiptEndpointError(502, "The receipt could not be extracted by the AI service.");
    }
  },
});
