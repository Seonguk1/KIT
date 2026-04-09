"use client";

import Link from "next/link";
import { COURSE_STATUS_LABELS, SESSION_VISIBILITY_LABELS } from "@/lib/ui-constants";

type CourseCardProps = {
  course: {
    id: string;
    title: string;
    description: string | null;
    status: keyof typeof COURSE_STATUS_LABELS;
    sessionCount: number;
    enrollmentCount: number;
  };
};

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group block rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_24px_70px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            {COURSE_STATUS_LABELS[course.status]}
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">
            {course.title}
          </h3>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
          {course.sessionCount}개 세션
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-zinc-600">
        {course.description ?? "설명이 등록되지 않았습니다."}
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-600">
        <span className="rounded-full bg-[#f5efe4] px-3 py-1 font-medium">
          수강자 {course.enrollmentCount}명
        </span>
        <span className="rounded-full bg-[#f5efe4] px-3 py-1 font-medium">
          세션 공개 상태 확인
        </span>
      </div>

      <div className="mt-6 text-sm font-semibold text-zinc-950 transition group-hover:translate-x-0.5">
        상세로 이동
      </div>
    </Link>
  );
}
