"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HOME_COPY, USER_ROLE } from "@/lib/ui-constants";
import { RoleSelectModal } from "@/components/role-select-modal";
import { getStoredUserRole, isUserRole, setStoredUserRole } from "@/lib/user-role";

const DEMO_ENDPOINTS = [
  "POST /api/upload-urls",
  "POST /api/materials",
  "GET /api/materials/{materialId}",
  "GET /api/recordings/{recordingId}",
  "POST /api/qa",
  "POST /api/sessions/{sessionId}/quizzes",
];

export function HomeShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const roleFromQuery = searchParams.get("role");

    if (isUserRole(roleFromQuery)) {
      setStoredUserRole(roleFromQuery);
      router.replace("/dashboard");
      return;
    }

    const storedRole = getStoredUserRole();
    if (storedRole) {
      router.replace("/dashboard");
    }
  }, [router, searchParams]);

  return (
    <>
      <RoleSelectModal
        onSelectRole={(role) => {
          setStoredUserRole(role);
          router.push("/dashboard");
        }}
      />

      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <section className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-black/10 bg-white/80 shadow-[0_30px_90px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8 sm:p-10 lg:p-14">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
                  {HOME_COPY.eyebrow}
                </p>
              </div>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                {HOME_COPY.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
                {HOME_COPY.description}
              </p>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  "역할 선택 팝업으로 즉시 진입",
                  "강사/수강생 화면 분기 구조",
                  "API 연결을 전제로 한 UI 골격",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-black/8 bg-[#fbf7f1] p-4 text-sm leading-6 text-zinc-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <aside className="border-t border-black/10 bg-zinc-950 p-8 text-zinc-50 lg:border-l lg:border-t-0 lg:p-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
                P0 API
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                현재 우선 구현 대상은 업로드, 상태 조회, 세션 조회, QA, 퀴즈
                생성/발행/응시입니다.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                {DEMO_ENDPOINTS.map((endpoint) => (
                  <li key={endpoint} className="rounded-xl border border-white/10 px-4 py-3">
                    {endpoint}
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                선택한 역할을 기준으로 다음 단계 화면을 이어 붙일 수 있도록 초기 진입만
                먼저 고정합니다.
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
