"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleSelectModal } from "@/components/role-select-modal";
import { COURSE_STATUS_LABELS, SESSION_VISIBILITY_LABELS, USER_ROLE } from "@/lib/ui-constants";
import { clearStoredUserRole, getStoredUserRole, setStoredUserRole, UserRole } from "@/lib/user-role";

type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  sessionCount: number;
  enrollmentCount: number;
  sessions: Array<{
    id: string;
    title: string;
    description: string | null;
    orderIndex: number;
    visibility: "draft" | "published" | "hidden";
    materialCount: number;
    recordingCount: number;
  }>;
};

type CourseDetailShellProps = {
  courseId: string;
};

export function CourseDetailShell({ courseId }: CourseDetailShellProps) {
  const router = useRouter();
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(null);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDescription, setNewSessionDescription] = useState("");
  const [newSessionVisibility, setNewSessionVisibility] = useState<"draft" | "published" | "hidden">("draft");
  const [newSessionStartAt, setNewSessionStartAt] = useState("");
  const [newSessionEndAt, setNewSessionEndAt] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<"pending" | "enrolled" | "error" | null>(null);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = getStoredUserRole();
    setResolvedRole(storedRole);
  }, []);

  const isTeacher = resolvedRole === USER_ROLE.TEACHER;
  const isStudent = resolvedRole === USER_ROLE.STUDENT;

  const roleLabel = useMemo(() => {
    if (isTeacher) {
      return "강사";
    }

    if (isStudent) {
      return "수강생";
    }

    return null;
  }, [isStudent, isTeacher]);

  useEffect(() => {
    if (!isTeacher && !isStudent) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadCourse() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/courses/${courseId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("강의 상세를 불러오지 못했습니다.");
        }

        const data = (await response.json()) as CourseDetail;
        if (isMounted) {
          setCourse(data);
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

    void loadCourse();

    return () => {
      isMounted = false;
    };
  }, [courseId, isStudent, isTeacher]);

  async function handleEnroll() {
    if (!course) return;

    setIsEnrolling(true);
    setEnrollmentStatus("pending");
    setEnrollmentMessage(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "신청에 실패했습니다.");
      }

      setEnrollmentStatus("enrolled");
      setEnrollmentMessage("강의 신청이 완료되었습니다.");

      // 3초 후 메시지 숨기기
      setTimeout(() => {
        setEnrollmentMessage(null);
      }, 3000);
    } catch (error) {
      setEnrollmentStatus("error");
      const message = error instanceof Error ? error.message : "신청 중 오류가 발생했습니다.";
      setEnrollmentMessage(message);

      // 3초 후 메시지 숨기기
      setTimeout(() => {
        setEnrollmentMessage(null);
      }, 3000);
    } finally {
      setIsEnrolling(false);
    }
  }

  async function handleCreateSession() {
    const title = newSessionTitle.trim();
    if (!title) {
      setCreateSessionError("세션명은 필수입니다.");
      return;
    }

    if (newSessionStartAt && newSessionEndAt && newSessionEndAt < newSessionStartAt) {
      setCreateSessionError("종료 시각은 시작 시각 이후여야 합니다.");
      return;
    }

    setCreateSessionError(null);
    setIsCreatingSession(true);

    try {
      const response = await fetch(`/api/courses/${courseId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: newSessionDescription.trim() || undefined,
          visibility: newSessionVisibility,
          startAt: newSessionStartAt || undefined,
          endAt: newSessionEndAt || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "세션 생성에 실패했습니다.");
      }

      const created = (await response.json()) as CourseDetail["sessions"][number];
      setCourse((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          sessionCount: previous.sessionCount + 1,
          sessions: [...previous.sessions, created],
        };
      });

      setIsCreateSessionModalOpen(false);
      setNewSessionTitle("");
      setNewSessionDescription("");
      setNewSessionVisibility("draft");
      setNewSessionStartAt("");
      setNewSessionEndAt("");
    } catch (error) {
      setCreateSessionError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsCreatingSession(false);
    }
  }

  if (!isTeacher && !isStudent) {
    return (
      <RoleSelectModal
        onSelectRole={(selectedRole) => {
          setStoredUserRole(selectedRole);
          setResolvedRole(selectedRole);
          router.replace(`/dashboard/courses/${courseId}`);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto h-80 w-full max-w-7xl animate-pulse rounded-[2rem] border border-black/8 bg-white/70" />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
          {errorMessage}
        </div>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-black/10 bg-white px-6 py-5 text-sm text-zinc-700">
          강의를 찾을 수 없습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-black/10 bg-white/85 px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
                >
                  ← 대시보드로 돌아가기
                </Link>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {COURSE_STATUS_LABELS[course.status]}
                </span>
                {roleLabel ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                    {roleLabel} 모드
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                {course.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                {course.description ?? "강의 설명이 없습니다."}
              </p>
            </div>

            <div className="grid gap-2 text-sm text-zinc-600 sm:text-right">
              <div>세션 {course.sessionCount}개</div>
              <div>수강자 {course.enrollmentCount}명</div>
              {isTeacher ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreateSessionError(null);
                    setIsCreateSessionModalOpen(true);
                  }}
                  className="mt-1 inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  세션 추가
                </button>
              ) : null}
              {isStudent ? (
                <button
                  type="button"
                  disabled={isEnrolling || enrollmentStatus === "enrolled"}
                  onClick={() => void handleEnroll()}
                  className="mt-1 inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEnrolling ? "신청 중..." : enrollmentStatus === "enrolled" ? "신청 완료" : "신청하기"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  clearStoredUserRole();
                  setResolvedRole(null);
                }}
                className="mt-1 inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                역할 다시 선택
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-2">
          {course.sessions.map((session) => (
            <Link
              key={session.id}
              href={`/dashboard/sessions/${session.id}`}
              className="group rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_24px_70px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
                    {SESSION_VISIBILITY_LABELS[session.visibility]}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">
                    {session.title}
                  </h2>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {session.orderIndex}번
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-600">
                {session.description ?? "세션 설명이 없습니다."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-600">
                <span className="rounded-full bg-[#f5efe4] px-3 py-1 font-medium">
                  자료 {session.materialCount}개
                </span>
                <span className="rounded-full bg-[#f5efe4] px-3 py-1 font-medium">
                  녹화본 {session.recordingCount}개
                </span>
              </div>
              <div className="mt-6 text-sm font-semibold text-zinc-950 transition group-hover:translate-x-0.5">
                세션 상세로 이동
              </div>
            </Link>
          ))}
        </div>
      </section>

      {isTeacher && isCreateSessionModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              if (!isCreatingSession) {
                setIsCreateSessionModalOpen(false);
              }
            }}
          />

          <section className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-black/10 bg-[#fffaf3] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">세션 생성</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">새 세션을 만듭니다</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              세션명과 공개 상태를 설정하면 다음 순번으로 자동 생성됩니다.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">세션명</span>
                <input
                  value={newSessionTitle}
                  onChange={(event) => setNewSessionTitle(event.target.value)}
                  placeholder="예: 1주차 - Transformer 개요"
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">세션 설명 (선택)</span>
                <textarea
                  value={newSessionDescription}
                  onChange={(event) => setNewSessionDescription(event.target.value)}
                  rows={3}
                  placeholder="이번 세션의 핵심 목표를 입력하세요"
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">공개 상태</span>
                <select
                  value={newSessionVisibility}
                  onChange={(event) => setNewSessionVisibility(event.target.value as "draft" | "published" | "hidden")}
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                >
                  <option value="draft">비공개</option>
                  <option value="published">공개</option>
                  <option value="hidden">숨김</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-800">시작 시각 (선택)</span>
                  <input
                    type="datetime-local"
                    value={newSessionStartAt}
                    onChange={(event) => setNewSessionStartAt(event.target.value)}
                    className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-800">종료 시각 (선택)</span>
                  <input
                    type="datetime-local"
                    value={newSessionEndAt}
                    onChange={(event) => setNewSessionEndAt(event.target.value)}
                    className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                  />
                </label>
              </div>
            </div>

            {createSessionError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {createSessionError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isCreatingSession}
                onClick={() => setIsCreateSessionModalOpen(false)}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isCreatingSession}
                onClick={() => void handleCreateSession()}
                className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingSession ? "생성 중..." : "세션 생성"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {enrollmentMessage ? (
        <div className={`fixed bottom-6 right-6 rounded-full px-4 py-3 text-sm font-medium shadow-lg transition ${
          enrollmentStatus === "enrolled"
            ? "border border-green-200 bg-green-50 text-green-700"
            : "border border-red-200 bg-red-50 text-red-700"
        }`}>
          {enrollmentMessage}
        </div>
      ) : null}
    </main>
  );
}
