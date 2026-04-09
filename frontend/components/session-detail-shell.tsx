"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleSelectModal } from "@/components/role-select-modal";
import { SessionLearningView } from "@/components/session-learning-view";
import { SESSION_VISIBILITY_LABELS, STATUS_LABELS, USER_ROLE } from "@/lib/ui-constants";
import { clearStoredUserRole, getStoredUserRole, setStoredUserRole, UserRole } from "@/lib/user-role";

const POLLING_INTERVALS_MS = [5000, 10000, 20000];
const MAX_POLLING_ATTEMPTS = 120;
const TOAST_DISPLAY_MS = 3000;
const MATERIAL_PENDING_STATUSES = new Set(["uploaded", "queued", "processing"]);
const RECORDING_PENDING_STATUSES = new Set(["uploaded", "queued", "transcribing", "post_processing"]);
const MATERIAL_STATUS_PRIORITY: Record<SessionDetail["materials"][number]["processingStatus"], number> = {
  failed: 0,
  processing: 1,
  queued: 2,
  uploaded: 3,
  completed: 4,
};
const RECORDING_STATUS_PRIORITY: Record<SessionDetail["recordings"][number]["sttStatus"], number> = {
  failed: 0,
  post_processing: 1,
  transcribing: 2,
  queued: 3,
  uploaded: 4,
  completed: 5,
};

function getStatusBadgeStyle(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

type SessionDetail = {
  id: string;
  courseId: string;
  title: string;
  visibility: "draft" | "published" | "hidden";
  materials: Array<{
    id: string;
    name: string;
    processingStatus: "uploaded" | "queued" | "processing" | "completed" | "failed";
  }>;
  recordings: Array<{
    id: string;
    name: string;
    sttStatus: "uploaded" | "queued" | "transcribing" | "post_processing" | "completed" | "failed";
    subtitleUrl: string | null;
  }>;
};

type SessionDetailShellProps = {
  sessionId: string;
};

export function SessionDetailShell({ sessionId }: SessionDetailShellProps) {
  const router = useRouter();
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [materialUploadProgress, setMaterialUploadProgress] = useState(0);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialUploadError, setMaterialUploadError] = useState<string | null>(null);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [newRecordingFile, setNewRecordingFile] = useState<File | null>(null);
  const [recordingUploadProgress, setRecordingUploadProgress] = useState(0);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingUploadError, setRecordingUploadError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pollingAttemptCount, setPollingAttemptCount] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    setResolvedRole(getStoredUserRole());
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      setPageVisible(!document.hidden);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, TOAST_DISPLAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

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

  const hasPendingAssets = useMemo(() => {
    if (!session) {
      return false;
    }

    const hasPendingMaterials = session.materials.some((material) => MATERIAL_PENDING_STATUSES.has(material.processingStatus));
    const hasPendingRecordings = session.recordings.some((recording) => RECORDING_PENDING_STATUSES.has(recording.sttStatus));
    return hasPendingMaterials || hasPendingRecordings;
  }, [session]);

  const instructorAnalysis = useMemo(() => {
    if (!session) {
      return null;
    }

    const materialCompletedCount = session.materials.filter((material) => material.processingStatus === "completed").length;
    const materialFailedCount = session.materials.filter((material) => material.processingStatus === "failed").length;
    const recordingCompletedCount = session.recordings.filter((recording) => recording.sttStatus === "completed").length;
    const recordingFailedCount = session.recordings.filter((recording) => recording.sttStatus === "failed").length;

    const totalAssetCount = session.materials.length + session.recordings.length;
    const completedAssetCount = materialCompletedCount + recordingCompletedCount;
    const completionRate = totalAssetCount > 0 ? Math.round((completedAssetCount / totalAssetCount) * 100) : 0;

    const nextAction =
      materialFailedCount + recordingFailedCount > 0
        ? "실패 항목 재업로드 또는 상태 점검이 필요합니다."
        : hasPendingAssets
          ? "처리 중 항목이 있어 자동 폴링으로 상태를 추적합니다."
          : "세션 학습 준비가 완료되었습니다. 퀴즈 공개를 진행하세요.";

    return {
      materialCompletedCount,
      materialFailedCount,
      recordingCompletedCount,
      recordingFailedCount,
      totalAssetCount,
      completedAssetCount,
      completionRate,
      nextAction,
    };
  }, [hasPendingAssets, session]);

  const sortedMaterials = useMemo(() => {
    if (!session) {
      return [];
    }

    return [...session.materials].sort(
      (a, b) => MATERIAL_STATUS_PRIORITY[a.processingStatus] - MATERIAL_STATUS_PRIORITY[b.processingStatus],
    );
  }, [session]);

  const sortedRecordings = useMemo(() => {
    if (!session) {
      return [];
    }

    return [...session.recordings].sort(
      (a, b) => RECORDING_STATUS_PRIORITY[a.sttStatus] - RECORDING_STATUS_PRIORITY[b.sttStatus],
    );
  }, [session]);

  const materialStatusSummary = useMemo(() => {
    if (!session) {
      return { completed: 0, pending: 0, failed: 0 };
    }

    const completed = session.materials.filter((item) => item.processingStatus === "completed").length;
    const failed = session.materials.filter((item) => item.processingStatus === "failed").length;
    return {
      completed,
      failed,
      pending: Math.max(session.materials.length - completed - failed, 0),
    };
  }, [session]);

  const recordingStatusSummary = useMemo(() => {
    if (!session) {
      return { completed: 0, pending: 0, failed: 0 };
    }

    const completed = session.recordings.filter((item) => item.sttStatus === "completed").length;
    const failed = session.recordings.filter((item) => item.sttStatus === "failed").length;
    return {
      completed,
      failed,
      pending: Math.max(session.recordings.length - completed - failed, 0),
    };
  }, [session]);

  const loadSession = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!silent) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("세션 상세를 불러오지 못했습니다.");
        }

        const data = (await response.json()) as SessionDetail;
        setSession(data);
        setLastSyncedAt(new Date());
        setPollingError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        if (!silent) {
          setErrorMessage(message);
        } else {
          setPollingError(`상태 갱신 실패: ${message}`);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (!isTeacher && !isStudent) {
      setIsLoading(false);
      return;
    }

    void loadSession();
  }, [isStudent, isTeacher, loadSession]);

  useEffect(() => {
    if (!isTeacher && !isStudent) {
      return;
    }

    if (!hasPendingAssets) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let intervalId: number | null = null;
    let timeoutId: number | null = null;
    let pollCount = 0;

    async function poll() {
      if (!pageVisible) {
        return;
      }

      if (pollCount >= MAX_POLLING_ATTEMPTS) {
        setIsPolling(false);
        setToastMessage("폴링 제한 시간 초과. 수동 새로고침이 필요합니다.");
        setToastType("error");
        return;
      }

      await loadSession({ silent: true });
      pollCount += 1;
      setPollingAttemptCount(pollCount);

      const nextInterval = POLLING_INTERVALS_MS[Math.min(Math.floor(pollCount / 6), POLLING_INTERVALS_MS.length - 1)];

      timeoutId = window.setTimeout(poll, nextInterval);
    }

    timeoutId = window.setTimeout(poll, POLLING_INTERVALS_MS[0]);

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      setIsPolling(false);
    };
  }, [hasPendingAssets, isStudent, isTeacher, loadSession, pageVisible]);

  useEffect(() => {
    if (!session || !isPolling) {
      return;
    }

    const materialsFailed = session.materials.filter((m) => m.processingStatus === "failed");
    const recordingsFailed = session.recordings.filter((r) => r.sttStatus === "failed");
    const allCompleted =
      session.materials.length > 0 &&
      session.recordings.length > 0 &&
      !hasPendingAssets &&
      materialsFailed.length === 0 &&
      recordingsFailed.length === 0;

    if (materialsFailed.length > 0 || recordingsFailed.length > 0) {
      setIsPolling(false);
      setToastMessage(`${materialsFailed.length + recordingsFailed.length}개 항목 처리 실패. 다시 시도해주세요.`);
      setToastType("error");
    } else if (allCompleted) {
      setIsPolling(false);
      setToastMessage("모든 자료와 녹화본 처리가 완료되었습니다!");
      setToastType("success");
    }
  }, [session, isPolling, hasPendingAssets]);

  async function handleCreateMaterial() {
    if (!session || !newMaterialFile) {
      setMaterialUploadError("파일을 선택하세요.");
      return;
    }

    const file = newMaterialFile;
    const fileName = file.name.replace(/\.[^.]*$/, "");
    const mimeType = file.type || "application/pdf";

    setMaterialUploadError(null);
    setIsUploadingMaterial(true);
    setMaterialUploadProgress(0);

    try {
      const uploadUrlResponse = await fetch("/api/upload-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: mimeType,
          purpose: "material",
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error("업로드 URL 생성에 실패했습니다.");
      }

      const { uploadUrl, fileUrl } = (await uploadUrlResponse.json()) as { uploadUrl: string; fileUrl: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setMaterialUploadProgress(percent);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("파일 업로드에 실패했습니다."));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("네트워크 오류가 발생했습니다."));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("업로드가 취소되었습니다."));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", mimeType);
        xhr.send(file);
      });

      const createResponse = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          name: fileName,
          fileUrl,
          mimeType,
        }),
      });

      if (!createResponse.ok) {
        const payload = (await createResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "자료 등록에 실패했습니다.");
      }

      const created = (await createResponse.json()) as { id: string; status: SessionDetail["materials"][number]["processingStatus"] };

      setSession((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          materials: [
            ...previous.materials,
            {
              id: created.id,
              name: fileName,
              processingStatus: created.status,
            },
          ],
        };
      });

      setLastSyncedAt(new Date());
      setIsMaterialModalOpen(false);
      setNewMaterialFile(null);
    } catch (error) {
      setMaterialUploadError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsUploadingMaterial(false);
      setMaterialUploadProgress(0);
    }
  }

  async function handleCreateRecording() {
    if (!session || !newRecordingFile) {
      setRecordingUploadError("파일을 선택하세요.");
      return;
    }

    const file = newRecordingFile;
    const fileName = file.name.replace(/\.[^.]*$/, "");
    const mimeType = file.type || "video/mp4";

    setRecordingUploadError(null);
    setIsUploadingRecording(true);
    setRecordingUploadProgress(0);

    try {
      const uploadUrlResponse = await fetch("/api/upload-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: mimeType,
          purpose: "recording",
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error("업로드 URL 생성에 실패했습니다.");
      }

      const { uploadUrl, fileUrl } = (await uploadUrlResponse.json()) as { uploadUrl: string; fileUrl: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setRecordingUploadProgress(percent);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("파일 업로드에 실패했습니다."));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("네트워크 오류가 발생했습니다."));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("업로드가 취소되었습니다."));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", mimeType);
        xhr.send(file);
      });

      const createResponse = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          name: fileName,
          fileUrl,
        }),
      });

      if (!createResponse.ok) {
        const payload = (await createResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "녹화본 등록에 실패했습니다.");
      }

      const created = (await createResponse.json()) as { id: string; status: SessionDetail["recordings"][number]["sttStatus"] };

      setSession((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          recordings: [
            ...previous.recordings,
            {
              id: created.id,
              name: fileName,
              sttStatus: created.status,
              subtitleUrl: null,
            },
          ],
        };
      });

      setLastSyncedAt(new Date());
      setIsRecordingModalOpen(false);
      setNewRecordingFile(null);
    } catch (error) {
      setRecordingUploadError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsUploadingRecording(false);
      setRecordingUploadProgress(0);
    }
  }

  if (!isTeacher && !isStudent) {
    return (
      <RoleSelectModal
        onSelectRole={(selectedRole) => {
          setStoredUserRole(selectedRole);
          setResolvedRole(selectedRole);
          router.replace(`/dashboard/sessions/${sessionId}`);
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

  if (!session) {
    return (
      <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-black/10 bg-white px-6 py-5 text-sm text-zinc-700">
          세션을 찾을 수 없습니다.
        </div>
      </main>
    );
  }

  if (isStudent) {
    return (
      <SessionLearningView
        sessionId={sessionId}
        courseId={session.courseId}
        sessionTitle={session.title}
        visibility={session.visibility}
      />
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-black/10 bg-white/85 px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/courses/${session.courseId}`}
                  className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
                >
                  ← 강의 상세로 돌아가기
                </Link>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {SESSION_VISIBILITY_LABELS[session.visibility]}
                </span>
                {roleLabel ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                    {roleLabel} 모드
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                {session.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                세션 자료, 녹화본, 자막 정보를 한 화면에서 확인합니다.
              </p>
            </div>

            <div className="text-sm text-zinc-600 sm:text-right">
              <div>자료 {session.materials.length}개</div>
              <div>녹화본 {session.recordings.length}개</div>
              {lastSyncedAt ? (
                <div className="mt-1 text-xs text-zinc-500">최근 동기화: {lastSyncedAt.toLocaleTimeString("ko-KR")}</div>
              ) : null}
              {isPolling ? (
                <div className="mt-1 text-xs font-semibold text-amber-700">상태 폴링 중 (지수 백오프: 최대 20초 간격)</div>
              ) : null}
              {isTeacher ? (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearStoredUserRole();
                      setResolvedRole(null);
                    }}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  >
                    역할 다시 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMaterialUploadError(null);
                      setIsMaterialModalOpen(true);
                    }}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  >
                    자료 업로드
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingUploadError(null);
                      setIsRecordingModalOpen(true);
                    }}
                    className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                  >
                    녹화본 업로드
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {toastMessage && toastType ? (
          <div
            className={`mx-auto w-full max-w-6xl rounded-[1.75rem] border px-6 py-4 text-sm font-semibold ${
              toastType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {toastMessage}
          </div>
        ) : null}

        {isTeacher && instructorAnalysis ? (
          <section className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">강사 분석</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">세션 준비 상태</h2>
                <p className="mt-1 text-sm text-zinc-600">자료/녹화본 처리 현황과 다음 액션을 확인합니다.</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
                준비율 {instructorAnalysis.completionRate}%
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-600">완료 자산</p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {instructorAnalysis.completedAssetCount}
                  <span className="ml-1 text-sm font-medium text-zinc-600">/ {instructorAnalysis.totalAssetCount}</span>
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-600">자료 완료/실패</p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {instructorAnalysis.materialCompletedCount}
                  <span className="mx-1 text-sm font-medium text-zinc-600">/</span>
                  <span className="text-red-700">{instructorAnalysis.materialFailedCount}</span>
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-600">녹화본 완료/실패</p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {instructorAnalysis.recordingCompletedCount}
                  <span className="mx-1 text-sm font-medium text-zinc-600">/</span>
                  <span className="text-red-700">{instructorAnalysis.recordingFailedCount}</span>
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              다음 액션: {instructorAnalysis.nextAction}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">자료</h2>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  완료 {materialStatusSummary.completed}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  대기 {materialStatusSummary.pending}
                </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  실패 {materialStatusSummary.failed}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {sortedMaterials.length > 0 ? sortedMaterials.map((material) => (
                <div key={material.id} className="rounded-2xl border border-black/10 bg-[#fbf7f1] px-4 py-3">
                  <p className="font-medium text-zinc-950">{material.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-zinc-600">처리 상태:</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeStyle(material.processingStatus)}`}>
                      {STATUS_LABELS[material.processingStatus] ?? material.processingStatus}
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-zinc-600">등록된 자료가 없습니다.</p>
              )}
              {pollingError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {pollingError}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">녹화본</h2>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  완료 {recordingStatusSummary.completed}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  대기 {recordingStatusSummary.pending}
                </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  실패 {recordingStatusSummary.failed}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {sortedRecordings.length > 0 ? sortedRecordings.map((recording) => (
                <div key={recording.id} className="rounded-2xl border border-black/10 bg-[#fbf7f1] px-4 py-3">
                  <p className="font-medium text-zinc-950">{recording.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-zinc-600">STT 상태:</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeStyle(recording.sttStatus)}`}>
                      {STATUS_LABELS[recording.sttStatus] ?? recording.sttStatus}
                    </span>
                  </div>
                  {recording.subtitleUrl ? (
                    <a
                      href={recording.subtitleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm font-semibold text-amber-800 hover:text-amber-900"
                    >
                      자막 파일 열기
                    </a>
                  ) : null}
                </div>
              )) : (
                <p className="text-sm text-zinc-600">등록된 녹화본이 없습니다.</p>
              )}
            </div>
          </section>
        </div>
      </section>

      {isTeacher && isMaterialModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              if (!isUploadingMaterial) {
                setIsMaterialModalOpen(false);
              }
            }}
          />

          <section className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-black/10 bg-[#fffaf3] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">자료 업로드</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">세션 자료를 등록합니다</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              PDF 파일을 선택하면 자동으로 업로드되고 구조화 처리가 시작됩니다.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">PDF 파일 선택</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={isUploadingMaterial}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    setNewMaterialFile(file ?? null);
                    setMaterialUploadError(null);
                  }}
                  className="block w-full text-sm file:mr-4 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-800 file:transition file:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              {newMaterialFile ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  선택된 파일: <span className="font-semibold">{newMaterialFile.name}</span>
                </div>
              ) : null}

              {isUploadingMaterial && materialUploadProgress > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600">업로드 진행률</span>
                    <span className="font-semibold text-zinc-900">{materialUploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-amber-200 bg-amber-50">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                      style={{ width: `${materialUploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {materialUploadError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {materialUploadError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isUploadingMaterial}
                onClick={() => {
                  setIsMaterialModalOpen(false);
                  setNewMaterialFile(null);
                }}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isUploadingMaterial || !newMaterialFile}
                onClick={() => void handleCreateMaterial()}
                className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingMaterial ? `업로드 중... ${materialUploadProgress}%` : "자료 업로드"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isTeacher && isRecordingModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-zinc-950/55 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              if (!isUploadingRecording) {
                setIsRecordingModalOpen(false);
              }
            }}
          />

          <section className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-black/10 bg-[#fffaf3] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.24)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">녹화본 업로드</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">세션 녹화본을 등록합니다</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              영상 파일을 선택하면 자동으로 업로드되고 전사 처리가 시작됩니다.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-800">영상 파일 선택</span>
                <input
                  type="file"
                  accept="video/*"
                  disabled={isUploadingRecording}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    setNewRecordingFile(file ?? null);
                    setRecordingUploadError(null);
                  }}
                  className="block w-full text-sm file:mr-4 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-800 file:transition file:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              {newRecordingFile ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  선택된 파일: <span className="font-semibold">{newRecordingFile.name}</span>
                </div>
              ) : null}

              {isUploadingRecording && recordingUploadProgress > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600">업로드 진행률</span>
                    <span className="font-semibold text-zinc-900">{recordingUploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-amber-200 bg-amber-50">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                      style={{ width: `${recordingUploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {recordingUploadError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {recordingUploadError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isUploadingRecording}
                onClick={() => {
                  setIsRecordingModalOpen(false);
                  setNewRecordingFile(null);
                }}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isUploadingRecording || !newRecordingFile}
                onClick={() => void handleCreateRecording()}
                className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingRecording ? `업로드 중... ${recordingUploadProgress}%` : "녹화본 업로드"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
