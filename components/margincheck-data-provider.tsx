"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { observeExpenseEntries } from "@/lib/expenses-service";
import { observeJobs } from "@/lib/jobs-service";
import { observeLabourEntries } from "@/lib/labour-service";
import type { ExpenseEntry, LabourEntry } from "@/types/entries";
import type { Job } from "@/types/job";

interface MarginCheckDataContextValue {
  jobs: Job[];
  labourEntries: LabourEntry[];
  expenseEntries: ExpenseEntry[];
  loading: boolean;
  error: string;
}

const MarginCheckDataContext = createContext<MarginCheckDataContextValue | null>(null);

export function MarginCheckDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const emptyValue = useMemo<MarginCheckDataContextValue>(() => ({
    jobs: [],
    labourEntries: [],
    expenseEntries: [],
    loading: false,
    error: "",
  }), []);

  if (!user) {
    return <MarginCheckDataContext.Provider value={emptyValue}>{children}</MarginCheckDataContext.Provider>;
  }

  return <AuthenticatedDataProvider key={user.uid} userId={user.uid}>{children}</AuthenticatedDataProvider>;
}

function AuthenticatedDataProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [labourByJob, setLabourByJob] = useState<Record<string, LabourEntry[]>>({});
  const [expensesByJob, setExpensesByJob] = useState<Record<string, ExpenseEntry[]>>({});
  const [jobsLoading, setJobsLoading] = useState(true);
  const [entryState, setEntryState] = useState<Record<string, { labour: boolean; expenses: boolean }>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    return observeJobs(
      userId,
      (nextJobs) => {
        setJobs(nextJobs);
        setJobsLoading(false);
      },
      () => {
        setError("Jobs could not be loaded from Firebase.");
        setJobsLoading(false);
      },
    );
  }, [userId]);

  useEffect(() => {
    if (jobs.length === 0) return;

    const unsubscribers = jobs.flatMap((job) => [
      observeLabourEntries(
        userId,
        job.id,
        (entries) => {
          setLabourByJob((current) => ({ ...current, [job.id]: entries }));
          setEntryState((current) => ({
            ...current,
            [job.id]: { ...(current[job.id] ?? { labour: false, expenses: false }), labour: true },
          }));
        },
        () => {
          setError("Labour entries could not be loaded from Firebase.");
          setEntryState((current) => ({
            ...current,
            [job.id]: { ...(current[job.id] ?? { labour: false, expenses: false }), labour: true },
          }));
        },
      ),
      observeExpenseEntries(
        userId,
        job.id,
        (entries) => {
          setExpensesByJob((current) => ({ ...current, [job.id]: entries }));
          setEntryState((current) => ({
            ...current,
            [job.id]: { ...(current[job.id] ?? { labour: false, expenses: false }), expenses: true },
          }));
        },
        () => {
          setError("Expenses could not be loaded from Firebase.");
          setEntryState((current) => ({
            ...current,
            [job.id]: { ...(current[job.id] ?? { labour: false, expenses: false }), expenses: true },
          }));
        },
      ),
    ]);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [jobs, userId]);

  const entriesLoading = jobs.some(({ id }) => {
    const state = entryState[id];
    return !state?.labour || !state?.expenses;
  });
  const value = useMemo<MarginCheckDataContextValue>(() => ({
    jobs,
    labourEntries: jobs.flatMap(({ id }) => labourByJob[id] ?? []),
    expenseEntries: jobs.flatMap(({ id }) => expensesByJob[id] ?? []),
    loading: jobsLoading || entriesLoading,
    error,
  }), [entriesLoading, error, expensesByJob, jobs, jobsLoading, labourByJob]);

  return <MarginCheckDataContext.Provider value={value}>{children}</MarginCheckDataContext.Provider>;
}

export function useMarginCheckData(): MarginCheckDataContextValue {
  const context = useContext(MarginCheckDataContext);
  if (!context) throw new Error("useMarginCheckData must be used inside MarginCheckDataProvider.");
  return context;
}
