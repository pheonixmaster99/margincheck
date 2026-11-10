import type { ReceiptMetadata } from "@/types/entries";

export type ReceiptDeleter = (receipt: ReceiptMetadata) => Promise<void>;

export class ReceiptCleanupQueue {
  private readonly pending = new Map<string, ReceiptMetadata>();

  constructor(private readonly deleteReceipt: ReceiptDeleter) {}

  schedule(receipt: ReceiptMetadata): void {
    this.pending.set(receipt.receiptId, receipt);
  }

  release(receipt: ReceiptMetadata): void {
    this.pending.delete(receipt.receiptId);
  }

  async remove(receipt: ReceiptMetadata): Promise<void> {
    this.schedule(receipt);
    await this.deleteReceipt(receipt);
    this.pending.delete(receipt.receiptId);
  }

  async flush(): Promise<void> {
    const receipts = [...this.pending.values()];
    if (receipts.length === 0) return;

    const results = await Promise.allSettled(
      receipts.map((receipt) => this.remove(receipt)),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) throw failure.reason;
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}
