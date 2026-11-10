import assert from "node:assert/strict";
import test from "node:test";
import { ReceiptCleanupQueue } from "../../lib/receipt-cleanup-queue";
import type { ReceiptMetadata } from "../../types/entries";

const receipt: ReceiptMetadata = {
  receiptId: "receipt-a",
  filename: "receipt.pdf",
  mimeType: "application/pdf",
  size: 1_024,
  storagePath: "users/user-a/jobs/job-a/receipts/receipt-a/receipt.pdf",
};

test("failed temporary receipt cleanup remains queued for retry", async () => {
  let attempts = 0;
  const queue = new ReceiptCleanupQueue(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary network failure");
  });

  await assert.rejects(queue.remove(receipt), /temporary network failure/);
  assert.equal(queue.pendingCount, 1);

  await queue.flush();
  assert.equal(attempts, 2);
  assert.equal(queue.pendingCount, 0);
});

test("releasing a saved receipt prevents cleanup from deleting it", async () => {
  let deleteCalls = 0;
  const queue = new ReceiptCleanupQueue(async () => {
    deleteCalls += 1;
  });

  queue.schedule(receipt);
  queue.release(receipt);
  await queue.flush();

  assert.equal(deleteCalls, 0);
  assert.equal(queue.pendingCount, 0);
});
