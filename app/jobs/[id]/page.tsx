import type { Metadata } from "next";
import { JobDetail } from "@/components/job-detail";

export const metadata: Metadata = {
  title: "Job Detail | MarginCheck",
  description: "Compare estimated and actual job performance.",
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobDetail jobId={id} />;
}
