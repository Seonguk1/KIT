"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SESSION_VISIBILITY_LABELS } from "@/lib/ui-constants";
import { PdfViewer } from "@/components/pdf-viewer";
import { VideoPlayer } from "@/components/video-player";
import { clearStoredUserRole } from "@/lib/user-role";

type SessionLearningViewProps = {
  sessionId: string;
  courseId: string;
  sessionTitle: string;
  visibility: "draft" | "published" | "hidden";
};

type SessionMaterial = {
  id: string;
  name: string;
  processingStatus: "uploaded" | "queued" | "processing" | "completed" | "failed";
};

type SessionRecording = {
  id: string;
  name: string;
  sttStatus: "uploaded" | "queued" | "transcribing" | "post_processing" | "completed" | "failed";
  subtitleUrl: string | null;
};

type RecordingDetail = {
  id: string;
  fileUrl: string;
};

type QaSourceRef = {
  materialId: string;
  sectionId: string | null;
  pageNumber: number | null;
  startMs: number | null;
  endMs: number | null;
};

type QaResult = {
  answer: string;
  sourceRefs: QaSourceRef[];
  outOfScope: boolean;
};

type QaItem = {
  id: string;
  question: string;
  answer: string;
  sourceRefs: QaSourceRef[];
  outOfScope: boolean;
};

type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  rawText: string;
  refinedText: string;
  pageNumber: number | null;
};

type TranscriptSegmentResponse = {
  segments: TranscriptSegment[];
  nextCursor: string | null;
};

type QuizCreateResponse = {
  quizId: string;
  status: "draft" | "published" | "hidden";
};

type QuizQuestion = {
  id: string;
  questionText: string;
  choices: string[];
  explanation: string | null;
  sourcePageNumber: number | null;
};

type QuizDetail = {
  quizId: string;
  status: "draft" | "published" | "hidden";
  title: string;
  questions: QuizQuestion[];
};

type QuizAttemptResponse = {
  attemptId: string;
  score: number;
};

export function SessionLearningView({
  sessionId,
  courseId,
  sessionTitle,
  visibility,
}: SessionLearningViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"material" | "recording">("material");
  const [materials, setMaterials] = useState<SessionMaterial[]>([]);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [recordingFileUrlById, setRecordingFileUrlById] = useState<Record<string, string>>({});
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const [interactionTab, setInteractionTab] = useState<"qa" | "quiz">("qa");
  const [questionInput, setQuestionInput] = useState("");
  const [qaItems, setQaItems] = useState<QaItem[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizStatus, setQuizStatus] = useState<"draft" | "published" | "hidden" | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [targetMaterialPage, setTargetMaterialPage] = useState<number | null>(null);
  const [targetSeekMs, setTargetSeekMs] = useState<number | null>(null);
  const [transcriptSegmentsByRecordingId, setTranscriptSegmentsByRecordingId] = useState<Record<string, TranscriptSegment[]>>({});
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);

  useEffect(() => {
    async function loadSessionContent() {
      setIsLoadingContent(true);
      setContentError(null);

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("세션 정보를 불러올 수 없습니다.");
        }

        const session = (await response.json()) as {
          materials: SessionMaterial[];
          recordings: SessionRecording[];
        };

        setMaterials(session.materials);
        setRecordings(session.recordings);

        setSelectedMaterialId(session.materials[0]?.id ?? null);
        setSelectedRecordingId(session.recordings[0]?.id ?? null);

        const recordingDetails = await Promise.all(
          session.recordings.map(async (recording) => {
            const detailResponse = await fetch(`/api/recordings/${recording.id}`, {
              cache: "no-store",
            });

            if (!detailResponse.ok) {
              return null;
            }

            return (await detailResponse.json()) as RecordingDetail;
          }),
        );

        const nextFileUrlMap: Record<string, string> = {};
        for (const detail of recordingDetails) {
          if (detail?.id && detail.fileUrl) {
            nextFileUrlMap[detail.id] = detail.fileUrl;
          }
        }
        setRecordingFileUrlById(nextFileUrlMap);
      } catch (error) {
        setContentError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setIsLoadingContent(false);
      }
    }

    void loadSessionContent();
  }, [sessionId]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

  const selectedRecording = useMemo(
    () => recordings.find((recording) => recording.id === selectedRecordingId) ?? null,
    [recordings, selectedRecordingId],
  );

  const selectedRecordingSegments = useMemo(
    () => (selectedRecordingId ? transcriptSegmentsByRecordingId[selectedRecordingId] ?? [] : []),
    [selectedRecordingId, transcriptSegmentsByRecordingId],
  );

  useEffect(() => {
    async function loadSegments(recordingId: string) {
      if (transcriptSegmentsByRecordingId[recordingId]) {
        return;
      }

      setIsLoadingSegments(true);

      try {
        const response = await fetch(`/api/recordings/${recordingId}/segments?limit=100`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as TranscriptSegmentResponse;
        setTranscriptSegmentsByRecordingId((prev) => ({
          ...prev,
          [recordingId]: data.segments ?? [],
        }));
      } finally {
        setIsLoadingSegments(false);
      }
    }

    if (selectedRecordingId) {
      void loadSegments(selectedRecordingId);
    }
  }, [selectedRecordingId, transcriptSegmentsByRecordingId]);

  async function handleAskQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = questionInput.trim();
    if (!question) {
      return;
    }

    setIsAsking(true);
    setQaError(null);

    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question }),
      });

      if (!response.ok) {
        throw new Error("질의응답 요청에 실패했습니다.");
      }

      const data = (await response.json()) as QaResult;
      setQaItems((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          question,
          answer: data.answer,
          sourceRefs: data.sourceRefs,
          outOfScope: data.outOfScope,
        },
        ...prev,
      ]);
      setQuestionInput("");
    } catch (error) {
      setQaError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsAsking(false);
    }
  }

  async function loadQuizDetail(nextQuizId: string) {
    const response = await fetch(`/api/quizzes/${nextQuizId}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("퀴즈 정보를 불러오지 못했습니다.");
    }

    const detail = (await response.json()) as QuizDetail;
    setQuizId(detail.quizId);
    setQuizStatus(detail.status);
    setQuizQuestions(detail.questions);
    setQuizAnswers({});
    setQuizScore(null);
  }

  async function handleGenerateQuiz() {
    setIsGeneratingQuiz(true);
    setQuizError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/quizzes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });

      if (!response.ok) {
        throw new Error("퀴즈 생성에 실패했습니다.");
      }

      const created = (await response.json()) as QuizCreateResponse;
      await loadQuizDetail(created.quizId);
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  function handleSelectQuizAnswer(questionId: string, answer: string) {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  async function handleSubmitQuiz() {
    if (!quizId || quizQuestions.length === 0) {
      return;
    }

    setIsSubmittingQuiz(true);
    setQuizError(null);

    try {
      const answers = quizQuestions.map((question) => ({
        questionId: question.id,
        answer: quizAnswers[question.id] ?? "",
      }));

      const response = await fetch(`/api/quizzes/${quizId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error("퀴즈 제출에 실패했습니다.");
      }

      const result = (await response.json()) as QuizAttemptResponse;
      setQuizScore(result.score);
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSubmittingQuiz(false);
    }
  }

  function handleNavigateBySource(source: QaSourceRef) {
    const canJumpPage = source.materialId && source.pageNumber !== null;
    const canSeekVideo = source.startMs !== null;

    if (canJumpPage) {
      setActiveTab("material");
      setSelectedMaterialId(source.materialId);
      setTargetMaterialPage(source.pageNumber);
      return;
    }

    if (canSeekVideo) {
      const fallbackRecordingId = selectedRecordingId ?? recordings[0]?.id ?? null;
      if (!fallbackRecordingId) {
        return;
      }

      setActiveTab("recording");
      setSelectedRecordingId(fallbackRecordingId);
      setTargetSeekMs(source.startMs);
    }
  }

  function handleSegmentClick(segment: TranscriptSegment) {
    setTargetSeekMs(segment.startMs);
  }

  function handleSegmentPageJump(segment: TranscriptSegment) {
    if (!selectedMaterialId || segment.pageNumber === null) {
      return;
    }

    setActiveTab("material");
    setTargetMaterialPage(segment.pageNumber);
  }

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8 lg:px-10">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-black/10 bg-white/85 px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/dashboard/courses/${courseId}`} className="text-sm font-semibold text-zinc-600 hover:text-zinc-950">
                  ← 강의로 돌아가기
                </Link>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {SESSION_VISIBILITY_LABELS[visibility]}
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                  학습 모드
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{sessionTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                자료와 녹화본을 학습합니다.
              </p>
            </div>
            <div className="text-sm text-zinc-600 sm:text-right">
              <div>자료 {materials.length}개</div>
              <div>녹화본 {recordings.length}개</div>
              <button
                type="button"
                onClick={() => {
                  clearStoredUserRole();
                  router.replace("/dashboard");
                }}
                className="mt-2 inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                역할 다시 선택
              </button>
            </div>
          </div>
        </header>

        {contentError ? (
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
            {contentError}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_2fr_1fr]">
          <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
            <div className="flex gap-2 border-b border-zinc-200 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("material")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "material" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                자료
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("recording")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "recording" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                녹화본
              </button>
            </div>
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {isLoadingContent ? (
                <p className="text-sm text-zinc-600">로딩 중...</p>
              ) : activeTab === "material" ? (
                materials.length > 0 ? (
                  materials.map((material) => (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => setSelectedMaterialId(material.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        selectedMaterialId === material.id
                          ? "border-amber-300 bg-amber-50"
                          : "border-black/10 bg-[#fbf7f1] hover:border-amber-300 hover:bg-amber-50"
                      }`}
                    >
                      <p className="font-medium text-zinc-950">{material.name}</p>
                      <p className="text-xs text-zinc-600">{material.processingStatus}</p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-zinc-600">등록된 자료가 없습니다.</p>
                )
              ) : recordings.length > 0 ? (
                recordings.map((recording) => (
                  <button
                    key={recording.id}
                    type="button"
                    onClick={() => setSelectedRecordingId(recording.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      selectedRecordingId === recording.id
                        ? "border-amber-300 bg-amber-50"
                        : "border-black/10 bg-[#fbf7f1] hover:border-amber-300 hover:bg-amber-50"
                    }`}
                  >
                    <p className="font-medium text-zinc-950">{recording.name}</p>
                    <p className="text-xs text-zinc-600">{recording.sttStatus}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-600">등록된 녹화본이 없습니다.</p>
              )}
            </div>
          </div>

          <div>
            {activeTab === "material" && selectedMaterial ? (
              <PdfViewer
                materialId={selectedMaterial.id}
                materialName={selectedMaterial.name}
                targetPage={targetMaterialPage}
                onPageSynced={() => setTargetMaterialPage(null)}
              />
            ) : activeTab === "recording" && selectedRecording ? (
              recordingFileUrlById[selectedRecording.id] ? (
                <VideoPlayer
                  recordingId={selectedRecording.id}
                  recordingName={selectedRecording.name}
                  videoUrl={recordingFileUrlById[selectedRecording.id]}
                  subtitleUrl={selectedRecording.subtitleUrl}
                  targetSeekMs={targetSeekMs}
                  onSeekSynced={() => setTargetSeekMs(null)}
                  segments={selectedRecordingSegments}
                  onSegmentClick={handleSegmentClick}
                  onSegmentPageJump={handleSegmentPageJump}
                />
              ) : (
                <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
                  <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50">
                    <p className="text-sm font-semibold text-zinc-700">녹화본 정보를 불러오는 중입니다...</p>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
                <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-zinc-700">
                      {activeTab === "material" ? "자료를 선택해주세요" : "녹화본을 선택해주세요"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">좌측 패널에서 항목을 클릭하면 콘텐츠가 표시됩니다</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
            <div className="flex gap-2 border-b border-zinc-200 pb-3">
              <button
                type="button"
                onClick={() => setInteractionTab("qa")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  interactionTab === "qa" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                Q&A
              </button>
              <button
                type="button"
                onClick={() => setInteractionTab("quiz")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  interactionTab === "quiz" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                퀴즈
              </button>
            </div>

            {interactionTab === "qa" ? (
              <div className="mt-4 space-y-3">
                <form onSubmit={handleAskQuestion} className="space-y-2">
                  <textarea
                    value={questionInput}
                    onChange={(event) => setQuestionInput(event.currentTarget.value)}
                    placeholder="자료 기반으로 질문해보세요"
                    className="h-24 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !questionInput.trim()}
                    className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAsking ? "답변 생성 중..." : "질문하기"}
                  </button>
                </form>

                {qaError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{qaError}</div>
                ) : null}

                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {qaItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center">
                      <p className="text-xs text-zinc-600">아직 질문이 없습니다.</p>
                    </div>
                  ) : (
                    qaItems.map((item) => (
                      <article key={item.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <p className="text-xs font-semibold text-zinc-500">질문</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900">{item.question}</p>

                        <p className="mt-3 text-xs font-semibold text-zinc-500">답변</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-800">{item.answer}</p>

                        {item.sourceRefs.length > 0 ? (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-semibold text-zinc-500">출처</p>
                            {item.sourceRefs.map((source, index) => (
                              <button
                                key={`${item.id}-${index}`}
                                type="button"
                                onClick={() => handleNavigateBySource(source)}
                                className="block text-xs text-amber-800 underline-offset-2 transition hover:text-amber-900 hover:underline"
                              >
                                p.{source.pageNumber ?? "-"}
                                {source.startMs !== null ? ` · ${(source.startMs / 1000).toFixed(1)}s` : ""}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {item.outOfScope ? (
                          <p className="mt-2 text-xs font-semibold text-red-700">자료 범위를 벗어난 질문입니다.</p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateQuiz()}
                  disabled={isGeneratingQuiz}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGeneratingQuiz ? "퀴즈 생성 중..." : "퀴즈 생성"}
                </button>

                {quizStatus ? (
                  <p className="text-xs text-zinc-600">상태: {quizStatus}</p>
                ) : null}

                {quizError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{quizError}</div>
                ) : null}

                {activeTab === "recording" ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold text-zinc-500">자막 탐색</p>
                    {isLoadingSegments ? (
                      <p className="mt-2 text-xs text-zinc-600">자막 세그먼트 로딩 중...</p>
                    ) : selectedRecordingSegments.length === 0 ? (
                      <p className="mt-2 text-xs text-zinc-600">자막 세그먼트가 없습니다.</p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-600">중앙 플레이어에서 자막을 클릭해 이동할 수 있습니다.</p>
                    )}
                  </div>
                ) : null}

                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {quizQuestions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center">
                      <p className="text-xs text-zinc-600">생성된 퀴즈가 없습니다.</p>
                    </div>
                  ) : (
                    quizQuestions.map((question, index) => (
                      <article key={question.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <p className="text-xs font-semibold text-zinc-500">문항 {index + 1}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900">{question.questionText}</p>
                        <div className="mt-3 space-y-2">
                          {question.choices.map((choice) => (
                            <label key={choice} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800">
                              <input
                                type="radio"
                                name={question.id}
                                value={choice}
                                checked={quizAnswers[question.id] === choice}
                                onChange={() => handleSelectQuizAnswer(question.id, choice)}
                                className="accent-amber-700"
                              />
                              <span>{choice}</span>
                            </label>
                          ))}
                        </div>
                        {question.sourcePageNumber !== null ? (
                          <p className="mt-2 text-xs text-zinc-600">출처 페이지: p.{question.sourcePageNumber}</p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>

                {quizQuestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmitQuiz()}
                    disabled={isSubmittingQuiz}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmittingQuiz ? "제출 중..." : "퀴즈 제출"}
                  </button>
                ) : null}

                {quizScore !== null ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    점수: {quizScore}점
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
