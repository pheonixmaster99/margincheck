import type { Metadata } from "next";
import { NewJobForm } from "@/components/new-job-form";

export const metadata: Metadata = {
  title: "New Job | MarginCheck",
  description: "Create a job and calculate its expected profit and margin.",
};

export default function NewJobPage() {
  return <NewJobForm />;
}
