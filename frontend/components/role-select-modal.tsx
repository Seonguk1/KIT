"use client";

import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLE } from "@/lib/ui-constants";

type RoleSelectModalProps = {
  onSelectRole: (role: typeof USER_ROLE.TEACHER | typeof USER_ROLE.STUDENT) => void;
};

export function RoleSelectModal({ onSelectRole }: RoleSelectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm" aria-hidden="true" />
      <section className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[2rem] border border-black/10 bg-[#fffaf3] shadow-[0_32px_120px_rgba(0,0,0,0.24)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              초기 진입
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              역할을 선택해 데모 흐름을 시작하세요.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
              로그인 없이 강사와 수강생 화면을 바로 전환할 수 있도록 구성했습니다.
              선택한 역할은 초기 화면의 진입 상태로 사용됩니다.
            </p>

            <div className="mt-8 space-y-3">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onSelectRole(role as keyof typeof ROLE_LABELS)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
                >
                  <span>
                    <span className="block text-lg font-semibold text-zinc-950">{label}</span>
                    <span className="mt-1 block text-sm leading-6 text-zinc-600">
                      {ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}
                    </span>
                  </span>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800 transition group-hover:bg-amber-100">
                    선택
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-black/10 bg-zinc-950 p-8 text-zinc-50 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              데모 기준
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-zinc-200">
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                무인증 데모 모드로 바로 진입합니다.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                역할 선택 이후 강사/수강생 공통 프레임이 즉시 바뀝니다.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                이후 화면은 API 응답을 직접 받아 렌더링하는 구조로 이어집니다.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
