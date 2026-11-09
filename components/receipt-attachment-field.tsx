"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { validateReceiptFile } from "@/lib/receipt-file";
import type { ReceiptMetadata } from "@/types/entries";

const ACCEPTED_RECEIPTS = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ isPdf }: { isPdf: boolean }) {
  return (
    <div className={`grid h-14 w-12 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
      {isPdf ? "PDF" : "FILE"}
    </div>
  );
}

export function ReceiptAttachmentField({
  existingReceipt,
  selectedFile,
  onSelect,
  onRemove,
}: {
  existingReceipt?: ReceiptMetadata;
  selectedFile: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const displayedAttachment = selectedFile ?? existingReceipt ?? null;
  const mimeType = selectedFile?.type ?? existingReceipt?.mimeType ?? "";
  const filename = selectedFile?.name ?? existingReceipt?.filename ?? "";
  const fileSize = selectedFile?.size ?? existingReceipt?.size ?? 0;
  const previewUrl = useMemo(
    () => selectedFile?.type.startsWith("image/") ? URL.createObjectURL(selectedFile) : null,
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateReceiptFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError("");
    onSelect(file);
  }

  function removeAttachment() {
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onRemove();
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="expense-receipt" className="text-[13px] font-semibold text-slate-700">Attach receipt <span className="font-normal text-slate-400">(optional)</span></label>
        <span className="text-[11px] text-slate-400">JPG, PNG, or PDF · max 10 MB</span>
      </div>
      <input ref={inputRef} id="expense-receipt" type="file" accept={ACCEPTED_RECEIPTS} onChange={handleFile} className="sr-only" />

      {displayedAttachment ? (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Selected receipt preview"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
            />
          ) : (
            <FileIcon isPdf={mimeType === "application/pdf"} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{filename}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(fileSize)} · {selectedFile ? "Ready to upload" : "Stored securely"}</p>
          </div>
          <div className="flex shrink-0 gap-3 text-xs font-semibold">
            <label htmlFor="expense-receipt" className="cursor-pointer text-blue-600 hover:text-blue-700">Replace</label>
            <button type="button" onClick={removeAttachment} className="text-red-500 hover:text-red-600">Remove</button>
          </div>
        </div>
      ) : (
        <label htmlFor="expense-receipt" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-semibold text-blue-600 transition hover:border-blue-400 hover:bg-blue-50/50">
          <span aria-hidden="true">↑</span> Attach receipt
        </label>
      )}
      {error ? <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
      <p className="mt-2 text-[11px] leading-4 text-slate-500">Receipt files are uploaded to your private Firebase Storage path when the expense is saved.</p>
    </div>
  );
}
