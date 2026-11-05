"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  getLocalMigrationSummary,
  isLocalMigrationComplete,
  migrateLocalData,
  type LocalMigrationSummary,
} from "@/lib/migration-service";

export function LegacyMigrationCard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<LocalMigrationSummary | null>(null);
  const [checking, setChecking] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [complete, setComplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const userId = user.uid;
    let cancelled = false;
    async function checkMigration() {
      const localSummary = getLocalMigrationSummary();
      const isComplete = await isLocalMigrationComplete(userId);
      if (!cancelled) {
        setSummary(localSummary);
        setComplete(isComplete);
      }
    }
    checkMigration()
      .catch(() => {
        if (!cancelled) setError("Migration status could not be checked.");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (checking || complete || dismissed || !summary || summary.jobs === 0 || !user) return null;

  async function startMigration() {
    if (!user) return;
    setMigrating(true);
    setError("");
    try {
      await migrateLocalData(user.uid);
      setComplete(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Local data could not be imported.");
      setMigrating(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-slate-900">Import data from this browser</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Found {summary.jobs} job{summary.jobs === 1 ? "" : "s"}, {summary.labourEntries} labour entries, {summary.expenses} expenses, and {summary.receipts} receipt references. Importing is safe to retry and will not delete local data.
          </p>
          {error ? <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
        </div>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => setDismissed(true)} disabled={migrating} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">Not now</button>
          <button type="button" onClick={startMigration} disabled={migrating} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{migrating ? "Importing…" : "Import Local Data"}</button>
        </div>
      </div>
    </section>
  );
}
