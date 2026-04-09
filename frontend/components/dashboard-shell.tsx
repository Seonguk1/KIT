"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseCard } from "@/components/course-card";
import { RoleSelectModal } from "@/components/role-select-modal";
import { DASHBOARD_COPY, USER_ROLE } from "@/lib/ui-constants";
import { clearStoredUserRole, getStoredUserRole, UserRole, setStoredUserRole } from "@/lib/user-role";

type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  sessionCount: number;
  enrollmentCount: number;
};

export function DashboardShell() {
  const router = useRouter();
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(null);

  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseStartDate, setNewCourseStartDate] = useState("");
  const [newCourseEndDate, setNewCourseEndDate] = useState("");
  const [newCourseCapacity, setNewCourseCapacity] = useState("");
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [createCourseError, setCreateCourseError] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = getStoredUserRole();
    setResolvedRole(storedRole);
  }, []);

  const isTeacher = resolvedRole === USER_ROLE.TEACHER;
  const isStudent = resolvedRole === USER_ROLE.STUDENT;
  const currentRole = useMemo(() => {
    if (isTeacher) {
      return "강사";
    }

    if (isStudent) {
      return "수강생";
    }

    return null;
  }, [isStudent, isTeacher]);

  async function handleCreateCourse() {
    const title = newCourseTitle.trim();
    if (!title) {
      setCreateCourseError("강의명은 필수입니다.");
      return;
    }

    if (newCourseStartDate && newCourseEndDate && newCourseEndDate < newCourseStartDate) {
      setCreateCourseError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    let capacityValue: number | undefined;
    if (newCourseCapacity.trim().length > 0) {
      const parsedCapacity = Number(newCourseCapacity);
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
        setCreateCourseError("정원은 1 이상의 정수여야 합니다.");
        return;
      }
      capacityValue = parsedCapacity;
    }

    setIsCreatingCourse(true);
    setCreateCourseError(null);

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: newCourseDescription.trim() || undefined,
          startDate: newCourseStartDate || undefined,
          endDate: newCourseEndDate || undefined,
          capacity: capacityValue,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "강의 생성에 실패했습니다.");
      }

      const created = (await response.json()) as CourseSummary;
      setIsCreateModalOpen(false);
      setNewCourseTitle("");
      setNewCourseDescription("");
      setNewCourseStartDate("");
      setNewCourseEndDate("");
      setNewCourseCapacity("");
      router.push(`/dashboard/courses/${created.id}`);
    } catch (error) {
      setCreateCourseError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsCreatingCourse(false);
    }
  }

  useEffect(() => {
    if (!isTeacher && !isStudent) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadCourses() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("강의 목록을 불러오지 못했습니다.");
        }

        const data = (await response.json()) as { courses?: CourseSummary[] };
        if (isMounted) {
          setCourses(data.courses ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCourses();

    return () => {
      isMounted = false;
    };
  }, [isStudent, isTeacher]);

  if (!isTeacher && !isStudent) {
    return (
      <RoleSelectModal
        onSelectRole={(selectedRole) => {
          setStoredUserRole(selectedRole);
          setResolvedRole(selectedRole);
          router.replace("/dashboard");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-black/10 bg-white/85 px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              {DASHBOARD_COPY.title}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              강의 카드를 눌러 상세로 이동하세요.
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {currentRole ? `${currentRole} 모드` : "역할 미지정"} · {DASHBOARD_COPY.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {isTeacher ? (
              <button
                type="button"
                onClick={() => {
                  setCreateCourseError(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                {DASHBOARD_COPY.teacherAction}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                clearStoredUserRole();
                setResolvedRole(null);
              }}
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              역할 다시 선택
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-56 rounded-[1.75rem] border border-black/8 bg-white/70 p-5"
              >
                <div className="h-4 w-24 animate-pulse rounded-full bg-zinc-200" />
                <div className="mt-4 h-6 w-3/4 animate-pulse rounded-full bg-zinc-200" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-zinc-200" />
                <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-[1.75rem] border border-black/10 bg-white/75 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-zinc-950">{DASHBOARD_COPY.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{DASHBOARD_COPY.emptyDescription}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      {isTeacher && isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              if (!isCreatingCourse) {
                setIsCreateModalOpen(false);
              }
            }}
          />
          <section className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-black/10 bg-[#fffaf3] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">강의 생성</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">새 강의를 만듭니다</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              강의명과 설명을 입력하면 초안 상태의 강의가 생성됩니다.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">강의명</span>
                <input
                  value={newCourseTitle}
                  onChange={(event) => setNewCourseTitle(event.target.value)}
                  placeholder="예: AI 개론 1주차"
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">설명 (선택)</span>
                <textarea
                  value={newCourseDescription}
                  onChange={(event) => setNewCourseDescription(event.target.value)}
                  placeholder="강의 목표와 운영 방식을 입력하세요"
                  rows={4}
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-800">시작일 (선택)</span>
                  <input
                    type="date"
                    value={newCourseStartDate}
                    onChange={(event) => setNewCourseStartDate(event.target.value)}
                    className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-800">종료일 (선택)</span>
                  <input
                    type="date"
                    value={newCourseEndDate}
                    onChange={(event) => setNewCourseEndDate(event.target.value)}
                    className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">정원 (선택)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={newCourseCapacity}
                  onChange={(event) => setNewCourseCapacity(event.target.value)}
                  placeholder="예: 40"
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                />
              </label>
            </div>

            {createCourseError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {createCourseError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isCreatingCourse}
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isCreatingCourse}
                onClick={() => void handleCreateCourse()}
                className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingCourse ? "생성 중..." : "강의 생성"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
