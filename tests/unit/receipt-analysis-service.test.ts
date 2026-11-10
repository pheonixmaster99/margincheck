import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeStoredReceipt,
  ReceiptAnalysisServiceError,
  type ReceiptAnalysisClientDependencies,
} from "../../lib/receipt-analysis-service";

function validResponse() {
  return {
    analysis: {
      vendor: "Builders Choice Hardware",
      date: null,
      total: 905.13,
      currency: "CAD",
      category: "materials",
      notes: "Paving materials",
      confidence: "medium",
      uncertainFields: ["date"],
      warnings: ["The date is ambiguous."],
    },
    receipt: {
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      size: 194_614,
    },
    job: {
      id: "job-a",
      currency: "CAD",
    },
  };
}

test("analyzeStoredReceipt sends the Firebase ID token and receipt identifiers", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const dependencies: ReceiptAnalysisClientDependencies = {
    getIdToken: async () => "firebase-id-token",
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Response.json(validResponse());
    },
  };

  const result = await analyzeStoredReceipt(
    {
      jobId: "job-a",
      storagePath: "users/user-a/jobs/job-a/receipts/receipt-a/receipt.pdf",
    },
    dependencies,
  );

  assert.equal(requestedUrl, "/api/ai/receipts/analyze");
  assert.equal(requestedInit?.method, "POST");
  assert.deepEqual(requestedInit?.headers, {
    Authorization: "Bearer firebase-id-token",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    jobId: "job-a",
    storagePath: "users/user-a/jobs/job-a/receipts/receipt-a/receipt.pdf",
  });
  assert.equal(result.analysis.total, 905.13);
});

test("analyzeStoredReceipt rejects unauthenticated use before fetch", async () => {
  let fetchCalls = 0;
  const dependencies: ReceiptAnalysisClientDependencies = {
    getIdToken: async () => null,
    fetcher: async () => {
      fetchCalls += 1;
      return Response.json({});
    },
  };

  await assert.rejects(
    analyzeStoredReceipt(
      { jobId: "job-a", storagePath: "users/user-a/jobs/job-a/receipts/r/file.pdf" },
      dependencies,
    ),
    (error: unknown) => error instanceof ReceiptAnalysisServiceError
      && error.code === "authentication-required",
  );
  assert.equal(fetchCalls, 0);
});

test("analyzeStoredReceipt maps endpoint failures to user-facing error codes", async () => {
  const cases = [
    [413, "too-large"],
    [415, "unsupported-type"],
    [429, "rate-limited"],
    [502, "extraction-failed"],
    [503, "service-unavailable"],
  ] as const;

  for (const [status, code] of cases) {
    const dependencies: ReceiptAnalysisClientDependencies = {
      getIdToken: async () => "firebase-id-token",
      fetcher: async () => Response.json({ error: "internal detail" }, { status }),
    };
    await assert.rejects(
      analyzeStoredReceipt(
        { jobId: "job-a", storagePath: "users/user-a/jobs/job-a/receipts/r/file.pdf" },
        dependencies,
      ),
      (error: unknown) => error instanceof ReceiptAnalysisServiceError
        && error.code === code
        && error.status === status,
    );
  }
});

test("analyzeStoredReceipt rejects malformed successful responses", async () => {
  const dependencies: ReceiptAnalysisClientDependencies = {
    getIdToken: async () => "firebase-id-token",
    fetcher: async () => Response.json({ analysis: validResponse().analysis }),
  };

  await assert.rejects(
    analyzeStoredReceipt(
      { jobId: "job-a", storagePath: "users/user-a/jobs/job-a/receipts/r/file.pdf" },
      dependencies,
    ),
    (error: unknown) => error instanceof ReceiptAnalysisServiceError
      && error.code === "invalid-response",
  );
});
