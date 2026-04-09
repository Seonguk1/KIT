import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { buildMaterialStructure, buildQuizQuestions, buildRecordingSegments } from "@/lib/demo-content.js";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient, getSupabaseStorageBucket } from "@/lib/supabase-admin";

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

type CourseCreateInput = {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
};

type SessionCreateInput = {
  title: string;
  description?: string;
  visibility?: "draft" | "published" | "hidden";
  startAt?: string;
  endAt?: string;
};

type SegmentFilterInput = {
  sectionId?: string;
  pageNumber?: number;
  cursor?: string;
  limit?: number;
};

const seedIds = {
  courseId: "course-ai-intro-01",
  sessionId: "session-ai-intro-01",
  materialId: "material-ai-intro-01",
  recordingId: "recording-ai-intro-01",
  quizId: "quiz-ai-intro-01",
  quizJobId: "job-ai-intro-01",
};

let seedPromise: Promise<void> | null = null;
const execFileAsync = promisify(execFile);

const MATERIAL_PENDING_STATUSES = new Set(["uploaded", "queued", "processing"]);
const RECORDING_PENDING_STATUSES = new Set(["uploaded", "queued", "transcribing", "post_processing"]);

function resolveMaterialStatusByElapsed(elapsedMs: number) {
  if (elapsedMs < 5000) {
    return "queued" as const;
  }

  if (elapsedMs < 12000) {
    return "processing" as const;
  }

  return "completed" as const;
}

function resolveRecordingStatusByElapsed(elapsedMs: number) {
  if (elapsedMs < 5000) {
    return "queued" as const;
  }

  if (elapsedMs < 12000) {
    return "transcribing" as const;
  }

  if (elapsedMs < 18000) {
    return "post_processing" as const;
  }

  return "completed" as const;
}

async function syncSessionAssetStatuses(sessionId: string) {
  const [materials, recordings] = await Promise.all([
    prisma.material.findMany({ where: { sessionId } }),
    prisma.recording.findMany({ where: { sessionId } }),
  ]);

  await Promise.all([
    ...materials
      .filter((material: { processingStatus: string }) => MATERIAL_PENDING_STATUSES.has(material.processingStatus))
      .map(async (material: { id: string; createdAt: Date; processingStatus: string; extractEnabled: boolean; pageCount: number }) => {
        const elapsedMs = Date.now() - material.createdAt.getTime();
        const nextStatus = resolveMaterialStatusByElapsed(elapsedMs);

        if (nextStatus === material.processingStatus) {
          return;
        }

        await prisma.material.update({
          where: { id: material.id },
          data: {
            processingStatus: nextStatus,
            tocStatus: nextStatus === "completed" ? "completed" : "pending",
            pageCountAnalyzed: nextStatus === "completed" ? material.pageCount : 0,
            analysisSummary: nextStatus === "completed"
              ? "문서 구조화와 페이지 분석이 완료되었습니다."
              : "문서 구조화를 준비 중입니다.",
            lastProcessedAt: new Date(),
          },
        });
      }),
    ...recordings
      .filter((recording: { sttStatus: string }) => RECORDING_PENDING_STATUSES.has(recording.sttStatus))
      .map(async (recording: { id: string; createdAt: Date; sttStatus: string }) => {
        const elapsedMs = Date.now() - recording.createdAt.getTime();
        const nextStatus = resolveRecordingStatusByElapsed(elapsedMs);

        if (nextStatus === recording.sttStatus) {
          return;
        }

        await prisma.recording.update({
          where: { id: recording.id },
          data: {
            sttStatus: nextStatus,
          },
        });
      }),
  ]);
}

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
      try {
        const courseCount = await prisma.course.count();
        if (courseCount > 0) {
          return;
        }

        await runDemoSeedScript();
      } catch (error) {
        console.warn("데이터베이스 연결 실패. Demo seed를 건너뜁니다.", error);
        // 연결 없이도 앱이 실행되도록 계속 진행
      }
    })();
  }

  return seedPromise;
}

export async function createUploadUrl(input: { fileName: string; contentType: string; purpose: string }) {
  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  const uploadToken = randomUUID();
  const safeName = slugify(input.fileName);
  const objectPath = `${input.purpose}/${uploadToken}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "failed to create signed upload URL");
  }

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(objectPath);

  return {
    uploadUrl: data.signedUrl,
    fileUrl: publicData.publicUrl,
    storagePath: objectPath,
    bucket,
    expiresAt: futureIso(10 * 60 * 1000),
  };
}

export async function listCourses() {
  await ensureDemoSeeded();

  const courses = await prisma.course.findMany({ orderBy: { createdAt: "asc" } });

  return Promise.all(
    courses.map(async (course: { id: string; title: string; description: string | null; status: string; startDate: Date | null; endDate: Date | null; capacity: number | null; thumbnailUrl: string | null }) => {
      const [sessionCount, enrollmentCount] = await Promise.all([
        prisma.session.count({ where: { courseId: course.id } }),
        prisma.courseEnrollment.count({ where: { courseId: course.id } }),
      ]);

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        startDate: course.startDate,
        endDate: course.endDate,
        capacity: course.capacity,
        thumbnailUrl: course.thumbnailUrl,
        sessionCount,
        enrollmentCount,
      };
    }),
  );
}

export async function createCourse(input: CourseCreateInput) {
  await ensureDemoSeeded();

  const title = input.title.trim();
  if (!title) {
    throw new Error("title is required");
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (typeof input.startDate === "string" && input.startDate.trim().length > 0) {
    const parsedStartDate = new Date(input.startDate);
    if (Number.isNaN(parsedStartDate.getTime())) {
      throw new Error("startDate is invalid");
    }
    startDate = parsedStartDate;
  }

  if (typeof input.endDate === "string" && input.endDate.trim().length > 0) {
    const parsedEndDate = new Date(input.endDate);
    if (Number.isNaN(parsedEndDate.getTime())) {
      throw new Error("endDate is invalid");
    }
    endDate = parsedEndDate;
  }

  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new Error("endDate must be after startDate");
  }

  let capacity: number | null = null;
  if (typeof input.capacity === "number") {
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      throw new Error("capacity must be a positive integer");
    }
    capacity = input.capacity;
  }

  const created = await prisma.course.create({
    data: {
      title,
      description: description.length > 0 ? description : null,
      status: "draft",
      startDate,
      endDate,
      capacity,
    },
  });

  return {
    id: created.id,
    title: created.title,
    description: created.description,
    status: created.status,
    startDate: created.startDate,
    endDate: created.endDate,
    capacity: created.capacity,
    thumbnailUrl: created.thumbnailUrl,
    sessionCount: 0,
    enrollmentCount: 0,
  };
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
    status: course.status,
    startDate: course.startDate,
    endDate: course.endDate,
    capacity: course.capacity,
    thumbnailUrl: course.thumbnailUrl,
    enrollmentCount,
    sessionCount: sessions.length,
    sessions: sessionCards,
  };
}

export async function createSession(courseId: string, input: SessionCreateInput) {
  await ensureDemoSeeded();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return null;
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("title is required");
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  const visibility = input.visibility ?? "draft";
  if (visibility !== "draft" && visibility !== "published" && visibility !== "hidden") {
    throw new Error("visibility is invalid");
  }

  let startAt: Date | null = null;
  let endAt: Date | null = null;

  if (typeof input.startAt === "string" && input.startAt.trim().length > 0) {
    const parsedStartAt = new Date(input.startAt);
    if (Number.isNaN(parsedStartAt.getTime())) {
      throw new Error("startAt is invalid");
    }
    startAt = parsedStartAt;
  }

  if (typeof input.endAt === "string" && input.endAt.trim().length > 0) {
    const parsedEndAt = new Date(input.endAt);
    if (Number.isNaN(parsedEndAt.getTime())) {
      throw new Error("endAt is invalid");
    }
    endAt = parsedEndAt;
  }

  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    throw new Error("endAt must be after startAt");
  }

  const orderIndexResult = await prisma.session.aggregate({
    where: { courseId },
    _max: { orderIndex: true },
  });
  const nextOrderIndex = (orderIndexResult._max.orderIndex ?? 0) + 1;

  const created = await prisma.session.create({
    data: {
      courseId,
      title,
      description: description.length > 0 ? description : null,
      orderIndex: nextOrderIndex,
      visibility,
      startAt,
      endAt,
    },
  });

  return {
    id: created.id,
    title: created.title,
    description: created.description,
    orderIndex: created.orderIndex,
    visibility: created.visibility,
    startAt: created.startAt,
    endAt: created.endAt,
    materialCount: 0,
    recordingCount: 0,
  };
}

export async function getSessionDetail(sessionId: string) {
  await ensureDemoSeeded();

  await syncSessionAssetStatuses(sessionId);

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
    courseId: session.courseId,
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

export async function getMaterial(materialId: string) {
  await ensureDemoSeeded();

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) {
    return null;
  }

  return {
    id: material.id,
    sessionId: material.sessionId,
    name: material.name,
    fileUrl: material.fileUrl,
    mimeType: material.mimeType,
    pageCount: material.pageCount,
    extractEnabled: material.extractEnabled,
    processingStatus: material.processingStatus,
    analysis: {
      analysisSummary: material.analysisSummary,
      tocStatus: material.tocStatus,
      pageCountAnalyzed: material.pageCountAnalyzed,
      lastProcessedAt: material.lastProcessedAt,
    },
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

export async function getRecording(recordingId: string) {
  await ensureDemoSeeded();

  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) {
    return null;
  }

  return {
    id: recording.id,
    sessionId: recording.sessionId,
    name: recording.name,
    fileUrl: recording.fileUrl,
    durationSeconds: recording.durationSeconds,
    sttStatus: recording.sttStatus,
    subtitleUrl: recording.subtitleUrl,
  };
}

export async function listTranscriptSegments(recordingId: string, filters: SegmentFilterInput) {
  await ensureDemoSeeded();

  const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording) {
    return null;
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const segments = await prisma.transcriptSegment.findMany({
    where: {
      recordingId,
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      ...(typeof filters.pageNumber === "number" ? { pageNumber: filters.pageNumber } : {}),
      ...(filters.cursor ? { id: { gt: filters.cursor } } : {}),
    },
    orderBy: { startMs: "asc" },
    take: limit,
  });

  const nextCursor = segments.length === limit ? segments[segments.length - 1]?.id ?? null : null;

  return { segments, nextCursor };
}

export async function patchTranscriptSegment(
  recordingId: string,
  segmentId: string,
  input: { refinedText?: string; sectionId?: string | null; pageNumber?: number | null },
) {
  await ensureDemoSeeded();

  const segment = await prisma.transcriptSegment.findFirst({ where: { id: segmentId, recordingId } });
  if (!segment) {
    return null;
  }

  return prisma.transcriptSegment.update({
    where: { id: segmentId },
    data: {
      refinedText: input.refinedText ?? segment.refinedText,
      sectionId: input.sectionId ?? segment.sectionId,
      pageNumber: input.pageNumber ?? segment.pageNumber,
    },
  });
}

export async function createMaterial(input: MaterialCreateInput) {
  await ensureDemoSeeded();

  const id = randomUUID();
  const pageCount = input.pageCount ?? 12;
  const title = input.name.replace(/\.pdf$/i, "");
  const structure = input.extractEnabled === false
    ? { sections: [] as Array<{ id: string; title: string; startPage: number; endPage: number }>, pages: [] as Array<{ pageNumber: number; sectionId: string | null; topicSentence: string; summary: string; keywords: string[] }> }
    : buildMaterialStructure(id, pageCount, title);

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
      processingStatus: "queued",
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
        id: `${id}-page-${page.pageNumber}`,
        materialId: id,
        pageNumber: page.pageNumber,
        sectionId: page.sectionId,
        topicSentence: page.topicSentence,
        summary: page.summary,
        keywords: page.keywords as never,
        embeddingStatus: "completed",
      },
    });
  }

  return { id, status: "queued" as const };
}

export async function createRecording(input: RecordingCreateInput) {
  await ensureDemoSeeded();

  const id = randomUUID();
  const material = await prisma.material.findFirst({ where: { sessionId: input.sessionId } });
  const sections = material
    ? await prisma.materialSection.findMany({ where: { materialId: material.id }, orderBy: { orderIndex: "asc" } })
    : [];

  const demoSections = sections.map((section: { id: string; title: string; startPage: number; endPage: number }) => ({
    id: section.id,
    title: section.title,
    startPage: section.startPage,
    endPage: section.endPage,
  }));

  const segmentBlueprints = buildRecordingSegments(id, demoSections);

  await prisma.recording.create({
    data: {
      id,
      sessionId: input.sessionId,
      name: input.name,
      fileUrl: input.fileUrl,
      durationSeconds: input.durationSeconds ?? 0,
      language: input.language ?? "ko",
      sttEnabled: input.sttEnabled ?? true,
      sttStatus: "queued",
      subtitleUrl: `https://storage.demo/files/${id}.vtt`,
    },
  });

  for (const segment of segmentBlueprints) {
    await prisma.transcriptSegment.create({
      data: {
        id: segment.id,
        recordingId: id,
        startMs: segment.startMs,
        endMs: segment.endMs,
        rawText: segment.rawText,
        refinedText: segment.refinedText,
        sectionId: segment.sectionId,
        pageNumber: segment.pageNumber,
        confidenceScore: segment.mappingScore,
      },
    });
  }

  return { id, status: "queued" as const };
}

export async function enrollCourse(courseId: string) {
  await ensureDemoSeeded();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return null;
  }

  // 데모 모드에서는 고정된 학생 ID 사용
  const studentUserId = "user-demo-student-01";

  // 이미 등록되었는지 확인
  const existing = await prisma.courseEnrollment.findFirst({
    where: { courseId, userId: studentUserId },
  });

  if (existing) {
    throw new Error("이미 신청한 강의입니다.");
  }

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId,
      userId: studentUserId,
      status: "applied",
      appliedAt: new Date(),
    },
  });

  return { id: enrollment.id, status: enrollment.status };
}

export async function getQaResponse(input: { sessionId: string; question: string }) {
  await ensureDemoSeeded();

  const material = (await prisma.material.findFirst({ where: { sessionId: input.sessionId } })) ?? (await prisma.material.findFirst());
  const recording = (await prisma.recording.findFirst({ where: { sessionId: input.sessionId } })) ?? (await prisma.recording.findFirst());

  return {
    answer: `질문 \"${input.question}\"에 대한 데모 답변입니다.`,
    sourceRefs: material
      ? [{ materialId: material.id, sectionId: null, pageNumber: 1, startMs: recording ? 0 : null, endMs: recording ? 31000 : null }]
      : [],
    outOfScope: false,
  };
}

export async function createQuiz(input: QuizCreateInput) {
  await ensureDemoSeeded();

  const material = (await prisma.material.findFirst({ where: { sessionId: input.sessionId } })) ?? (await prisma.material.findFirst());
  const materialId = material?.id ?? seedIds.materialId;
  const sectionCandidates = await prisma.materialSection.findMany({ where: { materialId }, orderBy: { orderIndex: "asc" }, take: 2 });
  const sectionId = input.sectionId ?? sectionCandidates[1]?.id ?? sectionCandidates[0]?.id ?? null;
  const count = Math.min(Math.max(input.count ?? 5, 1), 10);
  const quizId = randomUUID();

  await prisma.quiz.create({
    data: {
      id: quizId,
      sessionId: input.sessionId,
      materialId,
      sectionId,
      title: "데모 퀴즈",
      generatedBy: "ai",
      status: "draft",
    },
  });

  const questions = buildQuizQuestions(quizId, sectionId, count, materialId);
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

  const material = (await prisma.material.findFirst({ where: { sessionId: job.sessionId } })) ?? (await prisma.material.findFirst());
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

export async function getQuizDetail(quizId: string) {
  await ensureDemoSeeded();

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    return null;
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { createdAt: "asc" },
  });

  return {
    quizId: quiz.id,
    status: quiz.status,
    title: quiz.title,
    questions: questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      choices: Array.isArray(question.choices)
        ? question.choices.filter((choice): choice is string => typeof choice === "string")
        : [],
      explanation: question.explanation,
      sourcePageNumber: question.sourcePageNumber,
    })),
  };
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

    return {
      questionId: question.id,
      userAnswer,
      isCorrect,
      earnedScore: isCorrect ? 1 : 0,
    };
  });

  const correctCount = results.filter((item: { isCorrect: boolean }) => item.isCorrect).length;
  const attemptScore = questions.length === 0 ? 0 : Math.round((correctCount / questions.length) * 100);

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
