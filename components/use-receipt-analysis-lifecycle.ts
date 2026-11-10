"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeStoredReceipt } from "@/lib/receipt-analysis-service";
import { ReceiptCleanupQueue } from "@/lib/receipt-cleanup-queue";
import { deleteReceipt, uploadReceipt } from "@/lib/receipts-service";
import type { ReceiptMetadata } from "@/types/entries";
import type { Job } from "@/types/job";
import type { ReceiptAnalysisResult } from "@/types/receipt-analysis";

export type ReceiptAnalysisPhase =
  | "idle"
  | "uploading"
  | "analyzing"
  | "ready"
  | "error";

interface ReceiptAnalysisLifecycleState {
  phase: ReceiptAnalysisPhase;
  temporaryReceipt: ReceiptMetadata | null;
  analysis: ReceiptAnalysisResult | null;
  analysisError: string | null;
}

const INITIAL_STATE: ReceiptAnalysisLifecycleState = {
  phase: "idle",
  temporaryReceipt: null,
  analysis: null,
  analysisError: null,
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The receipt could not be prepared. Please try again.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useReceiptAnalysisLifecycle(
  job: Pick<Job, "id" | "ownerId">,
) {
  const [state, setState] = useState<ReceiptAnalysisLifecycleState>(INITIAL_STATE);
  const operationIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const temporaryReceiptRef = useRef<ReceiptMetadata | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const activePreparationRef = useRef<Promise<ReceiptMetadata | null> | null>(null);
  const cleanupQueueRef = useRef<ReceiptCleanupQueue | null>(null);
  if (cleanupQueueRef.current == null) {
    cleanupQueueRef.current = new ReceiptCleanupQueue(deleteReceipt);
  }

  const deleteTemporaryReceipt = useCallback(async (receipt: ReceiptMetadata): Promise<void> => {
    await cleanupQueueRef.current?.remove(receipt);
  }, []);

  const cleanupPendingReceipts = useCallback(async (): Promise<void> => {
    await cleanupQueueRef.current?.flush();
  }, []);

  const prepareReceipt = useCallback((file: File): Promise<ReceiptMetadata | null> => {
    if (selectedFileRef.current === file) {
      if (activePreparationRef.current) return activePreparationRef.current;
      if (temporaryReceiptRef.current) {
        return Promise.resolve(temporaryReceiptRef.current);
      }
    }

    const operationId = operationIdRef.current + 1;
    operationIdRef.current = operationId;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const previousReceipt = temporaryReceiptRef.current;
    temporaryReceiptRef.current = null;
    selectedFileRef.current = file;
    setState({
      phase: "uploading",
      temporaryReceipt: null,
      analysis: null,
      analysisError: null,
    });

    const preparation = (async () => {
      if (previousReceipt) {
        try {
          await deleteTemporaryReceipt(previousReceipt);
          await cleanupPendingReceipts();
        } catch (error) {
          if (operationIdRef.current === operationId) {
            temporaryReceiptRef.current = previousReceipt;
            selectedFileRef.current = null;
            setState({
              phase: "error",
              temporaryReceipt: previousReceipt,
              analysis: null,
              analysisError: errorMessage(error),
            });
          }
          throw error;
        }
      }

      if (operationIdRef.current !== operationId) return null;

      let uploadedReceipt: ReceiptMetadata;
      try {
        uploadedReceipt = await uploadReceipt(job.ownerId, job.id, file);
      } catch (error) {
        if (operationIdRef.current === operationId) {
          setState({
            phase: "error",
            temporaryReceipt: null,
            analysis: null,
            analysisError: errorMessage(error),
          });
        }
        throw error;
      }

      if (operationIdRef.current !== operationId) {
        await deleteTemporaryReceipt(uploadedReceipt);
        return null;
      }

      temporaryReceiptRef.current = uploadedReceipt;
      setState({
        phase: "analyzing",
        temporaryReceipt: uploadedReceipt,
        analysis: null,
        analysisError: null,
      });

      try {
        if (!uploadedReceipt.storagePath) {
          throw new Error("The uploaded receipt is missing its Storage path.");
        }
        const analysis = await analyzeStoredReceipt({
          jobId: job.id,
          storagePath: uploadedReceipt.storagePath,
          signal: abortController.signal,
        });
        if (operationIdRef.current === operationId) {
          setState({
            phase: "ready",
            temporaryReceipt: uploadedReceipt,
            analysis,
            analysisError: null,
          });
        }
      } catch (error) {
        if (operationIdRef.current === operationId && !isAbortError(error)) {
          setState({
            phase: "error",
            temporaryReceipt: uploadedReceipt,
            analysis: null,
            analysisError: errorMessage(error),
          });
        }
      }

      return uploadedReceipt;
    })();

    activePreparationRef.current = preparation;
    void preparation.then(
      () => {
        if (activePreparationRef.current === preparation) {
          activePreparationRef.current = null;
        }
      },
      () => {
        if (activePreparationRef.current === preparation) {
          activePreparationRef.current = null;
        }
      },
    );
    return preparation;
  }, [cleanupPendingReceipts, deleteTemporaryReceipt, job.id, job.ownerId]);

  const discardTemporaryReceipt = useCallback(async (): Promise<void> => {
    const activePreparation = activePreparationRef.current;
    operationIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activePreparationRef.current = null;
    selectedFileRef.current = null;

    const receipt = temporaryReceiptRef.current;
    temporaryReceiptRef.current = null;
    setState(INITIAL_STATE);
    if (receipt) cleanupQueueRef.current?.schedule(receipt);

    try {
      if (activePreparation) {
        await activePreparation.catch(() => null);
      }
      await cleanupPendingReceipts();
    } catch (error) {
      setState({
        phase: "error",
        temporaryReceipt: receipt ?? null,
        analysis: null,
        analysisError: errorMessage(error),
      });
      throw error;
    }
  }, [cleanupPendingReceipts]);

  const retryAnalysis = useCallback(async (): Promise<ReceiptAnalysisResult | null> => {
    const receipt = temporaryReceiptRef.current;
    if (!receipt) return null;
    if (!receipt.storagePath) {
      throw new Error("The uploaded receipt is missing its Storage path.");
    }

    const operationId = operationIdRef.current + 1;
    operationIdRef.current = operationId;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setState({
      phase: "analyzing",
      temporaryReceipt: receipt,
      analysis: null,
      analysisError: null,
    });

    try {
      const analysis = await analyzeStoredReceipt({
        jobId: job.id,
        storagePath: receipt.storagePath,
        signal: abortController.signal,
      });
      if (operationIdRef.current === operationId) {
        setState({
          phase: "ready",
          temporaryReceipt: receipt,
          analysis,
          analysisError: null,
        });
      }
      return analysis;
    } catch (error) {
      if (operationIdRef.current === operationId && !isAbortError(error)) {
        setState({
          phase: "error",
          temporaryReceipt: receipt,
          analysis: null,
          analysisError: errorMessage(error),
        });
      }
      if (isAbortError(error)) return null;
      throw error;
    }
  }, [job.id]);

  const releaseTemporaryReceipt = useCallback((): ReceiptMetadata | null => {
    operationIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activePreparationRef.current = null;
    selectedFileRef.current = null;
    const receipt = temporaryReceiptRef.current;
    temporaryReceiptRef.current = null;
    if (receipt) cleanupQueueRef.current?.release(receipt);
    setState(INITIAL_STATE);
    return receipt;
  }, []);

  useEffect(() => () => {
    const activePreparation = activePreparationRef.current;
    operationIdRef.current += 1;
    abortControllerRef.current?.abort();
    const receipt = temporaryReceiptRef.current;
    temporaryReceiptRef.current = null;
    if (receipt) cleanupQueueRef.current?.schedule(receipt);
    void (async () => {
      if (activePreparation) await activePreparation.catch(() => null);
      await cleanupPendingReceipts().catch(() => undefined);
    })();
  }, [cleanupPendingReceipts]);

  return {
    ...state,
    isUploading: state.phase === "uploading",
    isAnalyzing: state.phase === "analyzing",
    prepareReceipt,
    retryAnalysis,
    discardTemporaryReceipt,
    releaseTemporaryReceipt,
  };
}
