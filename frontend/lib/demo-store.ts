import { randomUUID } from "node:crypto";

type ProcessingStatus = "uploaded" | "queued" | "processing" | "completed" | "failed";
type SttStatus = "uploaded" | "queued" | "transcribing" | "post_processing" | "completed" | "failed";
type QuizStatus = "draft" | "published" | "hidden";
type JobStatus = "queued" | "processing" | "completed" | "failed";

type DemoSection = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
};

type DemoPage = {
  pageNumber: number;
  sectionId: string | null;
  topicSentence: string;
  summary: string;
  keywords: string[];
};

type DemoMaterial = {
  id: string;
  sessionId: string;
  type: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  pageCount: number;
  extractEnabled: boolean;
  processingStatus: ProcessingStatus;
  analysisSummary: string;
  tocStatus: "pending" | "completed" | "failed";
  pageCountAnalyzed: number;
  lastProcessedAt: string;
  sections: DemoSection[];
  pages: DemoPage[];
};

type DemoSegment = {
  id: string;
  startMs: number;
  endMs: number;
  rawText: string;
  refinedText: string;
  sectionId: string | null;
  pageNumber: number | null;
  mappingScore: number;
};

type DemoRecording = {
  id: string;
  sessionId: string;
  name: string;
  fileUrl: string;
  durationSeconds: number;
  language: string;
  sttStatus: SttStatus;
  subtitleUrl: string;
  segments: DemoSegment[];
};

type DemoQuestion = {
  id: string;
  type: "multiple_choice";
  questionText: string;
  choices: string[];
  answer: string;
  explanation: string;
  sourceMaterialId: string;
  sourcePageNumber: number;
  sourceSectionId: string;
};

type DemoQuiz = {
  id: string;
  sessionId: string;
  materialId: string;
  sectionId: string | null;
  title: string;
  generatedBy: string;
  status: QuizStatus;
  questions: DemoQuestion[];
};

type DemoQuizJob = {
  id: string;
  sessionId: string;
  status: JobStatus;
  quizId: string | null;
  error: string | null;
  count: number;
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type DemoSession = {
  id: string;
  courseId: string;
  title: string;
  visibility: "draft" | "published" | "hidden";
};

type DemoCourse = {
  id: string;
  title: string;
  description: string;
};

type DemoStore = {
  courses: DemoCourse[];
  sessions: DemoSession[];
  materials: DemoMaterial[];
  recordings: DemoRecording[];
  quizzes: DemoQuiz[];
  quizJobs: DemoQuizJob[];
};

type MaterialCreateInput = {
  sessionId: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  pageCount?: number;
  extractEnabled?: boolean;
  type?: string;
};

type RecordingCreateInput = {
  sessionId: string;
  name: string;
  fileUrl: string;
  durationSeconds?: number;
  language?: string;
  sttEnabled?: boolean;
};

type QuizCreateInput = {
  sessionId: string;
  sectionId?: string | null;
  count?: number;
};

type QuizAttemptInput = {
  userId?: string;
  answers: Array<{ questionId: string; answer: string }>;
};

const materialId = "material-ai-intro-01";
const recordingId = "recording-ai-intro-01";
const sessionId = "session-ai-intro-01";
const courseId = "course-ai-intro-01";
const quizId = "quiz-ai-intro-01";

function isoNow() {
  return new Date().toISOString();
}

function futureIso(milliseconds: number) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || randomUUID();
}

function buildMaterialStructure(materialIdValue: string, pageCount: number, title: string) {
  const sectionSpecs = [
    { title: "강의 개요", startPage: 1, endPage: Math.max(1, Math.min(3, pageCount)) },
    { title: "핵심 개념", startPage: 4, endPage: Math.max(4, Math.min(7, pageCount)) },
    { title: "실습 및 정리", startPage: 8, endPage: Math.max(8, pageCount) },
  ].filter((section) => section.startPage <= section.endPage);

  const sections: DemoSection[] = sectionSpecs.map((section, index) => ({
    id: `${materialIdValue}-section-${index + 1}`,
    title: section.title,
    startPage: section.startPage,
    endPage: section.endPage,
  }));

  const pages: DemoPage[] = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const section = sections.find(
      (item) => pageNumber >= item.startPage && pageNumber <= item.endPage,
    );

    return {
      pageNumber,
      sectionId: section?.id ?? null,
      topicSentence: `${title} ${pageNumber}페이지 핵심 요약`,
      summary: `${title}의 ${pageNumber}페이지에는 데모용 학습 구조와 AI 해설이 정리되어 있습니다.`,
      keywords: ["AI", "학습", "데모", `P${pageNumber}`],
    };
  });

  return { sections, pages };
}

function buildRecordingSegments(recordingIdValue: string, structure: ReturnType<typeof buildMaterialStructure>) {
  return [
    {
      id: `${recordingIdValue}-segment-1`,
      startMs: 0,
      endMs: 31000,
      rawText: "오늘은 강의자료 구조를 먼저 보고 핵심 목차를 정리합니다.",
      refinedText: "오늘은 강의자료 구조를 먼저 보고 핵심 목차를 정리합니다.",
      sectionId: structure.sections[0]?.id ?? null,
      pageNumber: 1,
      mappingScore: 0.95,
    },
    {
      id: `${recordingIdValue}-segment-2`,
      startMs: 31000,
      endMs: 62000,
      rawText: "그다음 녹화본 자막을 목차와 연결해 탐색 단위를 만듭니다.",
      refinedText: "그다음 녹화본 자막을 목차와 연결해 탐색 단위를 만듭니다.",
      sectionId: structure.sections[1]?.id ?? null,
      pageNumber: 4,
      mappingScore: 0.92,
    },
    {
      id: `${recordingIdValue}-segment-3`,
      startMs: 62000,
      endMs: 98000,
      rawText: "마지막으로 출처가 있는 QA와 퀴즈로 복습 흐름을 완성합니다.",
      refinedText: "마지막으로 출처가 있는 QA와 퀴즈로 복습 흐름을 완성합니다.",
      sectionId: structure.sections[2]?.id ?? null,
      pageNumber: 8,
      mappingScore: 0.94,
    },
  ];
}

function buildQuizQuestions(quizIdValue: string, sectionId: string | null, count: number) {
  const templates = [
    {
      questionText: "강의자료 업로드 후 먼저 생성되는 구조 정보는 무엇인가요?",
      choices: ["목차와 페이지 분석", "결제 정보", "알림 설정", "과제 점수"],
      answer: "목차와 페이지 분석",
      explanation: "이 서비스는 PDF를 먼저 구조화해 학습 탐색 기반을 만듭니다.",
      pageNumber: 1,
    },
    {
      questionText: "녹화본 자막을 보정할 때 우선 활용하는 것은 무엇인가요?",
      choices: ["외부 SNS", "강의자료의 목차와 전문용어", "임의 생성 문장", "결제 로그"],
      answer: "강의자료의 목차와 전문용어",
      explanation: "강의자료를 이용하면 자막 정확도와 탐색 연결성이 높아집니다.",
      pageNumber: 4,
    },
    {
      questionText: "QA 답변이 가져야 하는 기본 조건은 무엇인가요?",
      choices: ["근거 없는 빠른 답변", "자료 기반 출처 제공", "무조건 장문 응답", "랜덤 추천"],
      answer: "자료 기반 출처 제공",
      explanation: "교육용 QA는 출처가 연결되어야 신뢰성을 확보할 수 있습니다.",
      pageNumber: 8,
    },
  ];

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      id: `${quizIdValue}-question-${index + 1}`,
      type: "multiple_choice" as const,
      questionText: `${index + 1}. ${template.questionText}`,
      choices: template.choices,
      answer: template.answer,
      explanation: template.explanation,
      sourceMaterialId: materialId,
      sourcePageNumber: template.pageNumber,
      sourceSectionId: sectionId ?? `${materialId}-section-2`,
    };
  });
}

function createInitialState(): DemoStore {
  const structure = buildMaterialStructure(materialId, 12, "AI 학습 플랫폼 개론");
  const recordingSegments = buildRecordingSegments(recordingId, structure);

  return {
    courses: [
      {
        id: courseId,
        title: "AI 교육 플랫폼 데모",
        description: "강의자료, 녹화본, QA, 퀴즈를 연결하는 샘플 과정",
      },
    ],
    sessions: [
      {
        id: sessionId,
        courseId,
        title: "1주차: 자료 구조화와 질의응답",
        visibility: "published",
      },
    ],
    materials: [
      {
        id: materialId,
        sessionId,
        type: "lecture_pdf",
        name: "AI 학습 플랫폼 개론.pdf",
        fileUrl: "https://storage.demo/files/ai-intro.pdf",
        mimeType: "application/pdf",
        pageCount: 12,
        extractEnabled: true,
        processingStatus: "completed",
        analysisSummary: "강의 개요, 핵심 개념, 실습 정리로 구성된 3단계 목차를 추출했습니다.",
        tocStatus: "completed",
        pageCountAnalyzed: 12,
        lastProcessedAt: isoNow(),
        sections: structure.sections,
        pages: structure.pages,
      },
    ],
    recordings: [
      {
        id: recordingId,
        sessionId,
        name: "AI 학습 플랫폼 개론 - 녹화본.mp4",
        fileUrl: "https://storage.demo/files/ai-intro-recording.mp4",
        durationSeconds: 1080,
        language: "ko",
        sttStatus: "completed",
        subtitleUrl: "https://storage.demo/files/ai-intro-recording.vtt",
        segments: recordingSegments,
      },
    ],
    quizzes: [
      {
        id: quizId,
        sessionId,
        materialId,
        sectionId: structure.sections[1]?.id ?? null,
        title: "AI 학습 플랫폼 개론 퀴즈",
        generatedBy: "ai",
        status: "draft",
        questions: buildQuizQuestions(quizId, structure.sections[1]?.id ?? null, 3),
      },
    ],
    quizJobs: [
      {
        id: "job-ai-intro-01",
        sessionId,
        status: "completed",
        quizId,
        error: null,
        count: 3,
        sectionId: structure.sections[1]?.id ?? null,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    ],
  };
}

const globalForDemo = globalThis as typeof globalThis & {
  kitDemoStore?: DemoStore;
};

export const demoStore = globalForDemo.kitDemoStore ?? createInitialState();

if (process.env.NODE_ENV !== "production") {
  globalForDemo.kitDemoStore = demoStore;
}

export function createUploadUrl(input: { fileName: string; contentType: string; purpose: string }) {
  const uploadToken = randomUUID();
  const safeName = slugify(input.fileName);

  return {
    uploadUrl: `https://storage.demo/upload/${input.purpose}/${uploadToken}`,
    fileUrl: `https://storage.demo/files/${uploadToken}-${safeName}`,
    expiresAt: futureIso(10 * 60 * 1000),
  };
}

export function createMaterial(input: MaterialCreateInput) {
  const id = randomUUID();
  const pageCount = input.pageCount ?? 12;
  const title = input.name.replace(/\.pdf$/i, "");
  const structure = input.extractEnabled === false
    ? { sections: [] as DemoSection[], pages: [] as DemoPage[] }
    : buildMaterialStructure(id, pageCount, title);

  const material: DemoMaterial = {
    id,
    sessionId: input.sessionId,
    type: input.type ?? "lecture_pdf",
    name: input.name,
    fileUrl: input.fileUrl,
    mimeType: input.mimeType,
    pageCount,
    extractEnabled: input.extractEnabled ?? true,
    processingStatus: "uploaded",
    analysisSummary: input.extractEnabled === false
      ? "추출 비활성화 상태로 업로드만 완료되었습니다."
      : `${title} 문서를 구조화하는 작업이 시작되었습니다.`,
    tocStatus: input.extractEnabled === false ? "pending" : "completed",
    pageCountAnalyzed: input.extractEnabled === false ? 0 : pageCount,
    lastProcessedAt: isoNow(),
    sections: structure.sections,
    pages: structure.pages,
  };

  demoStore.materials.unshift(material);
  return material;
}

export function getMaterial(materialIdValue: string) {
  return demoStore.materials.find((material) => material.id === materialIdValue) ?? null;
}

export function createRecording(input: RecordingCreateInput) {
  const id = randomUUID();
  const material = demoStore.materials.find((item) => item.sessionId === input.sessionId) ?? demoStore.materials[0];
  const structure = material ? { sections: material.sections } : { sections: [] as DemoSection[] };
  const segments = input.sttEnabled === false
    ? []
    : buildRecordingSegments(id, { sections: structure.sections, pages: [] as DemoPage[] });

  const recording: DemoRecording = {
    id,
    sessionId: input.sessionId,
    name: input.name,
    fileUrl: input.fileUrl,
    durationSeconds: input.durationSeconds ?? 0,
    language: input.language ?? "ko",
    sttStatus: "uploaded",
    subtitleUrl: `https://storage.demo/files/${id}.vtt`,
    segments,
  };

  demoStore.recordings.unshift(recording);
  return recording;
}

export function getRecording(recordingIdValue: string) {
  return demoStore.recordings.find((recording) => recording.id === recordingIdValue) ?? null;
}

export function getSessionDetail(sessionIdValue: string) {
  const session = demoStore.sessions.find((item) => item.id === sessionIdValue);

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    title: session.title,
    visibility: session.visibility,
    materials: demoStore.materials
      .filter((material) => material.sessionId === sessionIdValue)
      .map((material) => ({
        id: material.id,
        name: material.name,
        processingStatus: material.processingStatus,
      })),
    recordings: demoStore.recordings
      .filter((recording) => recording.sessionId === sessionIdValue)
      .map((recording) => ({
        id: recording.id,
        name: recording.name,
        sttStatus: recording.sttStatus,
        subtitleUrl: recording.subtitleUrl,
      })),
  };
}

export function listMaterialSections(materialIdValue: string) {
  const material = getMaterial(materialIdValue);
  return material?.sections ?? null;
}

export function listMaterialPages(materialIdValue: string) {
  const material = getMaterial(materialIdValue);
  return material?.pages ?? null;
}

export function listTranscriptSegments(recordingIdValue: string, filters: { sectionId?: string; pageNumber?: number; cursor?: string; limit?: number }) {
  const recording = getRecording(recordingIdValue);

  if (!recording) {
    return null;
  }

  let items = [...recording.segments];

  if (filters.sectionId) {
    items = items.filter((segment) => segment.sectionId === filters.sectionId);
  }

  if (typeof filters.pageNumber === "number") {
    items = items.filter((segment) => segment.pageNumber === filters.pageNumber);
  }

  if (filters.cursor) {
    const cursorIndex = items.findIndex((segment) => segment.id === filters.cursor);
    if (cursorIndex >= 0) {
      items = items.slice(cursorIndex + 1);
    }
  }

  const limit = filters.limit ?? 50;
  const pagedItems = items.slice(0, limit);
  const nextCursor = items.length > limit ? items[limit - 1]?.id ?? null : null;

  return { items: pagedItems, nextCursor };
}

export function patchTranscriptSegment(recordingIdValue: string, segmentId: string, patch: { refinedText?: string; sectionId?: string; pageNumber?: number }) {
  const recording = getRecording(recordingIdValue);

  if (!recording) {
    return null;
  }

  const segment = recording.segments.find((item) => item.id === segmentId);

  if (!segment) {
    return null;
  }

  if (typeof patch.refinedText === "string") {
    segment.refinedText = patch.refinedText;
  }

  if (typeof patch.sectionId !== "undefined") {
    segment.sectionId = patch.sectionId;
  }

  if (typeof patch.pageNumber !== "undefined") {
    segment.pageNumber = patch.pageNumber;
  }

  segment.mappingScore = segment.sectionId || typeof segment.pageNumber === "number" ? 0.99 : 0.75;
  return segment;
}

export function getQaResponse(input: { sessionId: string; question: string }) {
  const material = demoStore.materials.find((item) => item.sessionId === input.sessionId) ?? demoStore.materials[0];
  const recording = demoStore.recordings.find((item) => item.sessionId === input.sessionId) ?? demoStore.recordings[0];
  const sourcePage = material.pages[3] ?? material.pages[0];
  const sourceSection = material.sections[1] ?? material.sections[0];
  const sourceSegment = recording.segments[1] ?? recording.segments[0];

  return {
    answer: `질문 "${input.question}"에 대한 데모 응답입니다. 강의자료와 녹화본을 근거로 답변을 생성합니다.`,
    sourceRefs: [
      {
        materialId: material.id,
        sectionId: sourceSection?.id ?? null,
        pageNumber: sourcePage?.pageNumber ?? 1,
        startMs: sourceSegment?.startMs ?? 0,
        endMs: sourceSegment?.endMs ?? 0,
        snippet: sourcePage?.summary ?? material.analysisSummary,
        score: 0.94,
      },
    ],
    confidence: 0.93,
  };
}

export function createQuiz(input: QuizCreateInput) {
  const id = randomUUID();
  const count = Math.min(Math.max(input.count ?? 5, 1), 10);
  const sectionId = input.sectionId ?? demoStore.materials[0]?.sections[1]?.id ?? null;
  const questions = buildQuizQuestions(id, sectionId, count);

  const quiz: DemoQuiz = {
    id,
    sessionId: input.sessionId,
    materialId: demoStore.materials[0]?.id ?? materialId,
    sectionId,
    title: "데모 퀴즈",
    generatedBy: "ai",
    status: "draft",
    questions,
  };

  demoStore.quizzes.unshift(quiz);
  return quiz;
}

export function startQuizGeneration(input: QuizCreateInput) {
  const job: DemoQuizJob = {
    id: randomUUID(),
    sessionId: input.sessionId,
    status: "queued",
    quizId: null,
    error: null,
    count: Math.min(Math.max(input.count ?? 5, 1), 10),
    sectionId: input.sectionId ?? null,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };

  demoStore.quizJobs.unshift(job);
  return job;
}

export function getQuizGeneration(jobId: string) {
  const job = demoStore.quizJobs.find((item) => item.id === jobId);

  if (!job) {
    return null;
  }

  if (job.status === "queued" || job.status === "processing") {
    const createdAt = new Date(job.createdAt).getTime();
    const elapsed = Date.now() - createdAt;

    if (elapsed > 1500 && !job.quizId) {
      const quiz = createQuiz({
        sessionId: job.sessionId,
        sectionId: job.sectionId,
        count: job.count,
      });

      job.status = "completed";
      job.quizId = quiz.id;
      job.updatedAt = isoNow();
    } else if (elapsed > 500) {
      job.status = "processing";
      job.updatedAt = isoNow();
    }
  }

  return job;
}

export function publishQuiz(quizIdValue: string) {
  const quiz = demoStore.quizzes.find((item) => item.id === quizIdValue);

  if (!quiz) {
    return null;
  }

  quiz.status = "published";
  return quiz;
}

export function submitQuizAttempt(quizIdValue: string, input: QuizAttemptInput) {
  const quiz = demoStore.quizzes.find((item) => item.id === quizIdValue);

  if (!quiz) {
    return null;
  }

  const answerMap = new Map(input.answers.map((item) => [item.questionId, item.answer]));
  const results = quiz.questions.map((question) => {
    const userAnswer = answerMap.get(question.id) ?? "";
    const normalizedAnswer = userAnswer.trim().toLowerCase();
    const normalizedCorrect = question.answer.trim().toLowerCase();
    const isCorrect = normalizedAnswer === normalizedCorrect;

    return {
      questionId: question.id,
      userAnswer,
      isCorrect,
      earnedScore: isCorrect ? 1 : 0,
    };
  });

  const correctCount = results.filter((item) => item.isCorrect).length;
  const score = quiz.questions.length === 0 ? 0 : Math.round((correctCount / quiz.questions.length) * 100);

  return {
    attemptId: randomUUID(),
    score,
  };
}

export function getQuiz(quizIdValue: string) {
  return demoStore.quizzes.find((quiz) => quiz.id === quizIdValue) ?? null;
}

export function getDemoSnapshot() {
  return {
    courseCount: demoStore.courses.length,
    sessionCount: demoStore.sessions.length,
    materialCount: demoStore.materials.length,
    recordingCount: demoStore.recordings.length,
    quizCount: demoStore.quizzes.length,
    apiBasePaths: [
      "/api/upload-urls",
      "/api/materials",
      "/api/recordings",
      "/api/sessions/{sessionId}",
      "/api/qa",
      "/api/sessions/{sessionId}/quizzes",
    ],
  };
}
