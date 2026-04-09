import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen px-6 py-8" />}>
      <DashboardShell />
    </Suspense>
  );
}
