import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dashboard | MarginCheck",
  description: "Track job profitability and margin performance.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
