import { Suspense } from "react";
import { CourseDetailShell } from "@/components/course-detail-shell";

type CourseDetailPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { courseId } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen px-6 py-8" />}>
      <CourseDetailShell courseId={courseId} />
    </Suspense>
  );
}
