import { Suspense } from "react";
import { SessionDetailShell } from "@/components/session-detail-shell";

type SessionDetailPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen px-6 py-8" />}>
      <SessionDetailShell sessionId={sessionId} />
    </Suspense>
  );
}
