import assert from "node:assert/strict";
import test from "node:test";
import {
  currencyMismatchWarning,
  InvalidReceiptAnalysisError,
  parseReceiptAnalysis,
} from "../../lib/receipt-analysis";
import {
  createAnalyzeReceiptHandler,
  ReceiptEndpointError,
  validateReceiptStoragePath,
  type AnalyzeReceiptDependencies,
} from "../../lib/receipt-analysis-endpoint";
import {
  MAX_RECEIPT_SIZE_BYTES,
  validateReceiptFileDescriptor,
} from "../../lib/receipt-file";
import type { ReceiptAnalysis } from "../../types/receipt-analysis";

function validAnalysis(overrides: Partial<Record<keyof ReceiptAnalysis, unknown>> = {}) {
  return {
    vendor: "Home Hardware",
    date: "2026-11-08",
    total: 186.42,
    currency: "CAD",
    category: "materials",
    notes: "Additional pavers",
    confidence: "high",
    uncertainFields: [],
    warnings: [],
    ...overrides,
  };
}

test("parseReceiptAnalysis accepts valid structured analysis", () => {
  const analysis = parseReceiptAnalysis(JSON.stringify(validAnalysis()), "CAD");
  assert.equal(analysis.vendor, "Home Hardware");
  assert.equal(analysis.total, 186.42);
  assert.deepEqual(analysis.warnings, []);
});

test("parseReceiptAnalysis accepts null vendor, date, and total", () => {
  const analysis = parseReceiptAnalysis(
    validAnalysis({ vendor: null, date: null, total: null }),
    "CAD",
  );
  assert.equal(analysis.vendor, null);
  assert.equal(analysis.date, null);
  assert.equal(analysis.total, null);
});

test("parseReceiptAnalysis rejects malformed model JSON", () => {
  assert.throws(
    () => parseReceiptAnalysis("not-json", "CAD"),
    InvalidReceiptAnalysisError,
  );
});

test("parseReceiptAnalysis rejects negative, NaN, and infinite totals", () => {
  for (const total of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => parseReceiptAnalysis(validAnalysis({ total }), "CAD"),
      InvalidReceiptAnalysisError,
    );
  }
});

test("parseReceiptAnalysis rejects invalid dates, categories, and currencies", () => {
  assert.throws(
    () => parseReceiptAnalysis(validAnalysis({ date: "2026-02-30" }), "CAD"),
    InvalidReceiptAnalysisError,
  );
  assert.throws(
    () => parseReceiptAnalysis(validAnalysis({ category: "labour" }), "CAD"),
    InvalidReceiptAnalysisError,
  );
  assert.throws(
    () => parseReceiptAnalysis(validAnalysis({ currency: "JPY" }), "CAD"),
    InvalidReceiptAnalysisError,
  );
});

test("parseReceiptAnalysis adds a deterministic currency mismatch warning", () => {
  const expected = currencyMismatchWarning("USD", "CAD");
  const analysis = parseReceiptAnalysis(validAnalysis({ currency: "USD" }), "CAD");
  assert.ok(expected);
  assert.deepEqual(analysis.warnings, [expected]);
});

test("validateReceiptStoragePath accepts the authenticated user's job path", () => {
  assert.deepEqual(
    validateReceiptStoragePath(
      "users/user-a/jobs/job-a/receipts/receipt-a/file.pdf",
      "user-a",
      "job-a",
    ),
    { receiptId: "receipt-a", filename: "file.pdf" },
  );
});

test("validateReceiptStoragePath rejects another user or another job", () => {
  for (const storagePath of [
    "users/user-b/jobs/job-a/receipts/receipt-a/file.pdf",
    "users/user-a/jobs/job-b/receipts/receipt-a/file.pdf",
  ]) {
    assert.throws(
      () => validateReceiptStoragePath(storagePath, "user-a", "job-a"),
      (error: unknown) => error instanceof ReceiptEndpointError && error.status === 403,
    );
  }
});

test("validateReceiptStoragePath rejects malformed paths", () => {
  for (const storagePath of [
    "users/user-a/jobs/job-a/file.pdf",
    "users/user-a/jobs/job-a/receipts/../file.pdf",
    "/users/user-a/jobs/job-a/receipts/receipt-a/file.pdf",
  ]) {
    assert.throws(
      () => validateReceiptStoragePath(storagePath, "user-a", "job-a"),
      (error: unknown) => error instanceof ReceiptEndpointError && error.status === 400,
    );
  }
});

test("receipt file validation rejects excessive size and unsupported MIME types", () => {
  assert.equal(
    validateReceiptFileDescriptor({
      mimeType: "image/jpeg",
      size: MAX_RECEIPT_SIZE_BYTES + 1,
    }),
    "too-large",
  );
  assert.equal(
    validateReceiptFileDescriptor({ mimeType: "text/plain", size: 100 }),
    "unsupported-type",
  );
});

function endpointDependencies(overrides: Partial<AnalyzeReceiptDependencies> = {}): AnalyzeReceiptDependencies {
  return {
    authenticate: async () => ({ uid: "user-a" }),
    loadReceipt: async () => ({
      filename: "receipt.pdf",
      mimeType: "application/pdf",
      size: 100,
      bytes: new Uint8Array([1, 2, 3]),
      jobCurrency: "CAD",
    }),
    analyzeReceipt: async () => parseReceiptAnalysis(validAnalysis(), "CAD"),
    ...overrides,
  };
}

test("receipt analysis endpoint returns 401 for an unauthenticated request", async () => {
  const handler = createAnalyzeReceiptHandler(endpointDependencies({
    authenticate: async () => {
      throw new ReceiptEndpointError(401, "Authentication required.");
    },
  }));
  const response = await handler(new Request("http://localhost/api/ai/receipts/analyze", {
    method: "POST",
    body: JSON.stringify({
      jobId: "job-a",
      storagePath: "users/user-a/jobs/job-a/receipts/receipt-a/file.pdf",
    }),
  }));
  assert.equal(response.status, 401);
});

test("invalid endpoint requests are rejected before loading a receipt or calling OpenAI", async () => {
  let loadCalls = 0;
  let analysisCalls = 0;
  const handler = createAnalyzeReceiptHandler(endpointDependencies({
    loadReceipt: async () => {
      loadCalls += 1;
      throw new Error("should not load");
    },
    analyzeReceipt: async () => {
      analysisCalls += 1;
      throw new Error("should not analyze");
    },
  }));
  const response = await handler(new Request("http://localhost/api/ai/receipts/analyze", {
    method: "POST",
    body: JSON.stringify({ jobId: "job-a" }),
  }));
  assert.equal(response.status, 400);
  assert.equal(loadCalls, 0);
  assert.equal(analysisCalls, 0);
});
