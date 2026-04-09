import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildMaterialStructure,
  buildQuizQuestions,
  buildRecordingSegments,
  seedIds,
} from "@/lib/demo-content.js";
import { prisma } from "@/lib/prisma";

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

let seedPromise: Promise<void> | null = null;
const execFileAsync = promisify(execFile);

function futureIso(milliseconds: number) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || randomUUID();
}

async function runDemoSeedScript() {
  const directPath = resolve(process.cwd(), "prisma", "seed.mjs");
  const monorepoPath = resolve(process.cwd(), "frontend", "prisma", "seed.mjs");
  const scriptPath = existsSync(directPath) ? directPath : monorepoPath;

  await execFileAsync(process.execPath, [scriptPath], { cwd: process.cwd() });
}

export async function ensureDemoSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const courseCount = await prisma.course.count();
      if (courseCount > 0) {
        return;
      }

      await runDemoSeedScript();
    })();
  }

  return seedPromise;
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

async function resolveMaterialWithContent(materialId: string) {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) {
    return null;
  }

  const [sections, pages] = await Promise.all([
    prisma.materialSection.findMany({ where: { materialId }, orderBy: { orderIndex: "asc" } }),
    prisma.materialPage.findMany({ where: { materialId }, orderBy: { pageNumber: "asc" } }),
  ]);

  return { ...material, sections, pages };
}

async function resolveRecordingWithSegments(recordingId: string) {
  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) {
    return null;
  }

  const segments = await prisma.transcriptSegment.findMany({
    where: { recordingId },
    orderBy: { startMs: "asc" },
  });

  return { ...recording, segments };
}

export async function listCourses() {
  await ensureDemoSeeded();

  const courses = await prisma.course.findMany({ orderBy: { createdAt: "asc" } });

  return Promise.all(
    courses.map(async (course: {
      id: string;
      title: string;
      description: string | null;
      instructorUserId: string | null;
      startDate: Date | null;
      endDate: Date | null;
      capacity: number | null;
      status: string;
      thumbnailUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    }) => {
      const [sessionCount, enrollmentCount] = await Promise.all([
        prisma.session.count({ where: { courseId: course.id } }),
        prisma.courseEnrollment.count({ where: { courseId: course.id } }),
      ]);

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        instructorUserId: course.instructorUserId,
        startDate: course.startDate,
        endDate: course.endDate,
        capacity: course.capacity,
        status: course.status,
        thumbnailUrl: course.thumbnailUrl,
        sessionCount,
        enrollmentCount,
      };
    }),
  );
}

export async function getCourseDetail(courseId: string) {
  await ensureDemoSeeded();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return null;
  }

  const [sessions, enrollmentCount] = await Promise.all([
    prisma.session.findMany({ where: { courseId }, orderBy: { orderIndex: "asc" } }),
    prisma.courseEnrollment.count({ where: { courseId } }),
  ]);

  const sessionCards = await Promise.all(
    sessions.map(async (session: { id: string; title: string; description: string | null; orderIndex: number; visibility: string; startAt: Date | null; endAt: Date | null }) => {
      const [materialCount, recordingCount] = await Promise.all([
        prisma.material.count({ where: { sessionId: session.id } }),
        prisma.recording.count({ where: { sessionId: session.id } }),
      ]);

      return {
        id: session.id,
        title: session.title,
        description: session.description,
        orderIndex: session.orderIndex,
        visibility: session.visibility,
        startAt: session.startAt,
        endAt: session.endAt,
        materialCount,
        recordingCount,
      };
    }),
  );

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    instructorUserId: course.instructorUserId,
    startDate: course.startDate,
    endDate: course.endDate,
    capacity: course.capacity,
    status: course.status,
    thumbnailUrl: course.thumbnailUrl,
    enrollmentCount,
    sessionCount: sessions.length,
    sessions: sessionCards,
  };
}

export async function createMaterial(input: MaterialCreateInput) {
  await ensureDemoSeeded();

  const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
  if (!session) {
    return null;
  }

  const id = randomUUID();
  const pageCount = input.pageCount ?? 12;
  const title = input.name.replace(/\.pdf$/i, "");
  const structure = input.extractEnabled === false ? { sections: [], pages: [] } : buildMaterialStructure(id, pageCount, title);

  await prisma.material.create({
    data: {
      id,
      sessionId: input.sessionId,
      type: (input.type ?? "lecture_pdf") as never,
      name: input.name,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      pageCount,
      isLocked: false,
      extractEnabled: input.extractEnabled ?? true,
      processingStatus: "uploaded",
      analysisSummary: input.extractEnabled === false
        ? "추출 비활성화 상태로 업로드만 완료되었습니다."
        : `${title} 문서를 구조화하는 작업이 시작되었습니다.`,
      tocStatus: input.extractEnabled === false ? "pending" : "completed",
      pageCountAnalyzed: input.extractEnabled === false ? 0 : pageCount,
      lastProcessedAt: new Date(),
    },
  });

  for (const section of structure.sections) {
    await prisma.materialSection.create({
      data: {
        id: section.id,
        materialId: id,
        parentSectionId: null,
        title: section.title,
        level: 1,
        startPage: section.startPage,
        endPage: section.endPage,
        orderIndex: section.startPage,
      },
    });
  }

  for (const page of structure.pages) {
    await prisma.materialPage.create({
      data: {
        id: page.id,
        materialId: id,
        pageNumber: page.pageNumber,
        sectionId: page.sectionId,
        topicSentence: page.topicSentence,
        summary: page.summary,
        keywords: page.keywords,
        embeddingStatus: "completed",
      },
    });
  }

  return resolveMaterialWithContent(id);
}

export async function getMaterial(materialId: string) {
  await ensureDemoSeeded();
  return resolveMaterialWithContent(materialId);
}

export async function createRecording(input: RecordingCreateInput) {
  await ensureDemoSeeded();

  const id = randomUUID();
  const recording = await prisma.recording.create({
    data: {
      id,
      sessionId: input.sessionId,
      name: input.name,
      fileUrl: input.fileUrl,
      durationSeconds: input.durationSeconds ?? 0,
      language: input.language ?? "ko",
      sttEnabled: input.sttEnabled ?? true,
      sttStatus: "uploaded",
      subtitleUrl: `https://storage.demo/files/${id}.vtt`,
    },
  });

  if (input.sttEnabled !== false) {
    const baseMaterial = await prisma.material.findFirst({ where: { sessionId: input.sessionId } });
    const sections = baseMaterial
      ? await prisma.materialSection.findMany({ where: { materialId: baseMaterial.id }, orderBy: { orderIndex: "asc" } })
      : [];

    const segments = buildRecordingSegments(id, sections);

    for (const segment of segments) {
      await prisma.transcriptSegment.create({
        data: {
          id: segment.id,
          recordingId: id,
          startMs: segment.startMs,
          endMs: segment.endMs,
          rawText: segment.rawText,
          refinedText: segment.refinedText,
          speakerLabel: null,
          sectionId: segment.sectionId,
          pageNumber: segment.pageNumber,
          confidenceScore: segment.mappingScore,
        },
      });
    }
  }

  return recording;
}

export async function getRecording(recordingId: string) {
  await ensureDemoSeeded();
  return resolveRecordingWithSegments(recordingId);
}

export async function getSessionDetail(sessionId: string) {
  await ensureDemoSeeded();

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return null;
  }

  const [materials, recordings] = await Promise.all([
    prisma.material.findMany({ where: { sessionId } }),
    prisma.recording.findMany({ where: { sessionId } }),
  ]);

  return {
    id: session.id,
    title: session.title,
    visibility: session.visibility,
    materials: materials.map((material: { id: string; name: string; processingStatus: string }) => ({
      id: material.id,
      name: material.name,
      processingStatus: material.processingStatus,
    })),
    recordings: recordings.map((recording: { id: string; name: string; sttStatus: string; subtitleUrl: string | null }) => ({
      id: recording.id,
      name: recording.name,
      sttStatus: recording.sttStatus,
      subtitleUrl: recording.subtitleUrl,
    })),
  };
}

export async function listMaterialSections(materialId: string) {
  await ensureDemoSeeded();
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) {
    return null;
  }

  return prisma.materialSection.findMany({ where: { materialId }, orderBy: { orderIndex: "asc" } });
}

export async function listMaterialPages(materialId: string) {
  await ensureDemoSeeded();
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) {
    return null;
  }

  return prisma.materialPage.findMany({ where: { materialId }, orderBy: { pageNumber: "asc" } });
}

export async function listTranscriptSegments(
  recordingId: string,
  filters: { sectionId?: string; pageNumber?: number; cursor?: string; limit?: number },
) {
  await ensureDemoSeeded();

  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) {
    return null;
  }

  const take = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const segments = await prisma.transcriptSegment.findMany({
    where: {
      recordingId,
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      ...(typeof filters.pageNumber === "number" ? { pageNumber: filters.pageNumber } : {}),
      ...(filters.cursor ? { id: { gt: filters.cursor } } : {}),
    },
    orderBy: { startMs: "asc" },
    take,
  });

  const nextCursor = segments.length === take ? segments[segments.length - 1]?.id ?? null : null;

  return {
    items: segments.map((segment: {
      id: string;
      startMs: number;
      endMs: number;
      rawText: string;
      refinedText: string | null;
      sectionId: string | null;
      pageNumber: number | null;
      confidenceScore: number | null;
    }) => ({
      id: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      rawText: segment.rawText,
      refinedText: segment.refinedText,
      sectionId: segment.sectionId,
      pageNumber: segment.pageNumber,
      mappingScore: segment.confidenceScore ?? 0,
    })),
    nextCursor,
  };
}

export async function patchTranscriptSegment(
  recordingId: string,
  segmentId: string,
  patch: { refinedText?: string; sectionId?: string; pageNumber?: number },
) {
  await ensureDemoSeeded();

  const segment = await prisma.transcriptSegment.findFirst({ where: { id: segmentId, recordingId } });
  if (!segment) {
    return null;
  }

  const updated = await prisma.transcriptSegment.update({
    where: { id: segmentId },
    data: {
      ...(typeof patch.refinedText === "string" ? { refinedText: patch.refinedText } : {}),
      ...(typeof patch.sectionId === "string" ? { sectionId: patch.sectionId } : {}),
      ...(typeof patch.pageNumber === "number" ? { pageNumber: patch.pageNumber } : {}),
      confidenceScore:
        typeof patch.sectionId === "string" || typeof patch.pageNumber === "number"
          ? 0.99
          : 0.75,
    },
  });

  return {
    id: updated.id,
    startMs: updated.startMs,
    endMs: updated.endMs,
    rawText: updated.rawText,
    refinedText: updated.refinedText,
    sectionId: updated.sectionId,
    pageNumber: updated.pageNumber,
    mappingScore: updated.confidenceScore ?? 0,
  };
}

export async function getQaResponse(input: { sessionId: string; question: string }) {
  await ensureDemoSeeded();

  const material = (await prisma.material.findFirst({ where: { sessionId: input.sessionId } }))
    ?? (await prisma.material.findFirst());
  const recording = (await prisma.recording.findFirst({ where: { sessionId: input.sessionId } }))
    ?? (await prisma.recording.findFirst());

  if (!material || !recording) {
    return {
      answer: "샘플 데이터를 찾을 수 없습니다.",
      sourceRefs: [],
      confidence: 0,
    };
  }

  const page = await prisma.materialPage.findFirst({ where: { materialId: material.id }, orderBy: { pageNumber: "asc" } });
  const section = page?.sectionId
    ? await prisma.materialSection.findUnique({ where: { id: page.sectionId } })
    : await prisma.materialSection.findFirst({ where: { materialId: material.id }, orderBy: { orderIndex: "asc" } });
  const segment = await prisma.transcriptSegment.findFirst({ where: { recordingId: recording.id }, orderBy: { startMs: "asc" } });

  return {
    answer: `질문 "${input.question}"에 대한 데모 응답입니다. 강의자료와 녹화본을 근거로 답변을 생성합니다.`,
    sourceRefs: [
      {
        materialId: material.id,
        sectionId: section?.id ?? null,
        pageNumber: page?.pageNumber ?? 1,
        startMs: segment?.startMs ?? 0,
        endMs: segment?.endMs ?? 0,
        snippet: page?.summary ?? material.analysisSummary ?? "샘플 답변 근거",
        score: 0.94,
      },
    ],
    confidence: 0.93,
  };
}

export async function createQuiz(input: QuizCreateInput) {
  await ensureDemoSeeded();

  const material = await prisma.material.findFirst({ where: { sessionId: input.sessionId } });
  const sectionCandidates = await prisma.materialSection.findMany({
    where: { materialId: material?.id ?? seedIds.materialId },
    orderBy: { orderIndex: "asc" },
    take: 2,
  });
  const sectionId = input.sectionId ?? sectionCandidates[1]?.id ?? sectionCandidates[0]?.id ?? null;
  const count = Math.min(Math.max(input.count ?? 5, 1), 10);
  const quizId = randomUUID();

  await prisma.quiz.create({
    data: {
      id: quizId,
      sessionId: input.sessionId,
      materialId: material?.id ?? seedIds.materialId,
      sectionId,
      title: "데모 퀴즈",
      generatedBy: "ai",
      status: "draft",
    },
  });

  const questions = buildQuizQuestions(quizId, sectionId, count, material?.id ?? seedIds.materialId);

  for (const question of questions) {
    await prisma.quizQuestion.create({
      data: {
        id: question.id,
        quizId,
        type: "multiple_choice",
        questionText: question.questionText,
        choices: question.choices,
        answer: question.answer,
        explanation: question.explanation,
        sourceMaterialId: question.sourceMaterialId,
        sourcePageNumber: question.sourcePageNumber,
        sourceSectionId: question.sourceSectionId,
      },
    });
  }

  return { id: quizId, status: "draft" as const };
}

export async function startQuizGeneration(input: QuizCreateInput) {
  await ensureDemoSeeded();

  const jobId = randomUUID();
  await prisma.quizGenerationJob.create({
    data: {
      id: jobId,
      sessionId: input.sessionId,
      status: "queued",
      quizId: null,
      error: null,
      count: Math.min(Math.max(input.count ?? 5, 1), 10),
      sectionId: input.sectionId ?? null,
    },
  });

  return { id: jobId, status: "queued" as const, quizId: null, error: null };
}

export async function getQuizGeneration(jobId: string) {
  await ensureDemoSeeded();

  const job = await prisma.quizGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }

  if (job.status === "completed" || job.status === "failed") {
    return job;
  }

  const elapsed = Date.now() - job.createdAt.getTime();
  if (elapsed <= 500) {
    return prisma.quizGenerationJob.update({ where: { id: jobId }, data: { status: "processing" } });
  }

  const material = await prisma.material.findFirst({ where: { sessionId: job.sessionId } });
  const materialId = material?.id ?? seedIds.materialId;
  const existingQuizId = job.quizId ?? randomUUID();
  const quiz = await prisma.quiz.create({
    data: {
      id: existingQuizId,
      sessionId: job.sessionId,
      materialId,
      sectionId: job.sectionId,
      title: "비동기 생성 퀴즈",
      generatedBy: "ai",
      status: "draft",
    },
  });

  const questions = buildQuizQuestions(quiz.id, job.sectionId ?? null, job.count, materialId);
  for (const question of questions) {
    await prisma.quizQuestion.create({
      data: {
        id: question.id,
        quizId: quiz.id,
        type: "multiple_choice",
        questionText: question.questionText,
        choices: question.choices,
        answer: question.answer,
        explanation: question.explanation,
        sourceMaterialId: question.sourceMaterialId,
        sourcePageNumber: question.sourcePageNumber,
        sourceSectionId: question.sourceSectionId,
      },
    });
  }

  return prisma.quizGenerationJob.update({
    where: { id: jobId },
    data: { status: "completed", quizId: quiz.id },
  });
}

export async function publishQuiz(quizId: string) {
  await ensureDemoSeeded();

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    return null;
  }

  const updated = await prisma.quiz.update({ where: { id: quizId }, data: { status: "published" } });
  return { id: updated.id, status: updated.status };
}

export async function submitQuizAttempt(quizId: string, input: QuizAttemptInput) {
  await ensureDemoSeeded();

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    return null;
  }

  const questions = await prisma.quizQuestion.findMany({ where: { quizId }, orderBy: { createdAt: "asc" } });
  const answerMap = new Map(input.answers.map((item) => [item.questionId, item.answer]));
  const results = questions.map((question: { id: string; answer: string }) => {
    const userAnswer = answerMap.get(question.id) ?? "";
    const isCorrect = userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    return { questionId: question.id, userAnswer, isCorrect, earnedScore: isCorrect ? 1 : 0 };
  });

  const attemptScore = questions.length === 0
    ? 0
    : Math.round((results.filter((item: { isCorrect: boolean }) => item.isCorrect).length / questions.length) * 100);

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      userId: input.userId ?? null,
      score: attemptScore,
      submittedAt: new Date(),
    },
  });

  for (const result of results) {
    await prisma.quizAttemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: result.questionId,
        userAnswer: result.userAnswer,
        isCorrect: result.isCorrect,
        earnedScore: result.earnedScore,
      },
    });
  }

  return { attemptId: attempt.id, score: attempt.score };
}
