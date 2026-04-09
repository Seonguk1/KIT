import { Suspense } from "react";
import { HomeShell } from "@/components/home-shell";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomeShell />
    </Suspense>
  );
}
