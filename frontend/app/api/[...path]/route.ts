import { NextRequest, NextResponse } from "next/server";
import {
  createCourse,
  createMaterial,
  createQuiz,
  createRecording,
  createSession,
  createUploadUrl,
  ensureDemoSeeded,
  enrollCourse,
  getCourseDetail,
  getQuizDetail,
  listCourses,
  getMaterial,
  getQaResponse,
  getQuizGeneration,
  getRecording,
  getSessionDetail,
  listMaterialPages,
  listMaterialSections,
  listTranscriptSegments,
  patchTranscriptSegment,
  publishQuiz,
  startQuizGeneration,
  submitQuizAttempt,
} from "@/lib/api-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function notFound(message = "Resource not found") {
  return json({ error: { code: "NOT_FOUND", message } }, 404);
}

function badRequest(message = "Invalid input") {
  return json({ error: { code: "BAD_REQUEST", message } }, 400);
}

function internalServerError(message = "Internal server error") {
  return json({ error: { code: "INTERNAL_SERVER_ERROR", message } }, 500);
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function toNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  await ensureDemoSeeded();
  const { path = [] } = await context.params;
  const [head, tail, third, fourth] = path;

  if (head === "materials" && tail && !third) {
    const material = await getMaterial(tail);

    if (!material) {
      return notFound("Material not found");
    }

    return json({
      id: material.id,
      sessionId: material.sessionId,
      name: material.name,
      fileUrl: material.fileUrl,
      mimeType: material.mimeType,
      pageCount: material.pageCount,
      extractEnabled: material.extractEnabled,
      processingStatus: material.processingStatus,
      analysis: material.analysis,
    });
  }

  if (head === "materials" && tail && third === "sections") {
    const sections = await listMaterialSections(tail);

    if (!sections) {
      return notFound("Material not found");
    }

    return json({ sections });
  }

  if (head === "materials" && tail && third === "pages") {
    const pages = await listMaterialPages(tail);

    if (!pages) {
      return notFound("Material not found");
    }

    return json({ pages });
  }

  if (head === "recordings" && tail && !third) {
    const recording = await getRecording(tail);

    if (!recording) {
      return notFound("Recording not found");
    }

    return json({
      id: recording.id,
      sessionId: recording.sessionId,
      name: recording.name,
      fileUrl: recording.fileUrl,
      durationSeconds: recording.durationSeconds,
      sttStatus: recording.sttStatus,
      subtitleUrl: recording.subtitleUrl,
    });
  }

  if (head === "recordings" && tail && third === "segments" && !fourth) {
    const sectionId = request.nextUrl.searchParams.get("sectionId") ?? undefined;
    const pageNumber = toNumber(request.nextUrl.searchParams.get("pageNumber")) ?? undefined;
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const limit = toNumber(request.nextUrl.searchParams.get("limit")) ?? undefined;
    const segments = await listTranscriptSegments(tail, { sectionId, pageNumber, cursor, limit });

    if (!segments) {
      return notFound("Recording not found");
    }

    return json(segments);
  }

  if (head === "recordings" && tail && third === "subtitle") {
    const recording = await getRecording(tail);

    if (!recording) {
      return notFound("Recording not found");
    }

    return json({
      subtitleUrl: recording.subtitleUrl,
      format: "vtt",
    });
  }

  if (head === "sessions" && tail && !third) {
    const session = await getSessionDetail(tail);

    if (!session) {
      return notFound("Session not found");
    }

    return json(session);
  }

  if (head === "courses" && !tail) {
    const courses = await listCourses();
    return json({ courses });
  }

  if (head === "courses" && tail && !third) {
    const course = await getCourseDetail(tail);

    if (!course) {
      return notFound("Course not found");
    }

    return json(course);
  }

  if (head === "quiz-generations" && tail && !third) {
    const job = await getQuizGeneration(tail);

    if (!job) {
      return notFound("Quiz generation job not found");
    }

    return json({
      jobId: job.id,
      status: job.status,
      quizId: job.quizId,
      error: job.error,
    });
  }

  if (head === "quizzes" && tail && third === "publish") {
    const quiz = await publishQuiz(tail);

    if (!quiz) {
      return notFound("Quiz not found");
    }

    return json({
      quizId: quiz.id,
      status: quiz.status,
    });
  }

  if (head === "quizzes" && tail && !third) {
    const quiz = await getQuizDetail(tail);

    if (!quiz) {
      return notFound("Quiz not found");
    }

    return json(quiz);
  }

  return notFound();
}

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureDemoSeeded();
  const { path = [] } = await context.params;
  const [head, tail, third] = path;
  const body = await readJsonBody(request);

  if (head === "upload-urls") {
    if (!body?.fileName || !body?.contentType || !body?.purpose) {
      return badRequest("fileName, contentType, and purpose are required");
    }

    try {
      return json(await createUploadUrl(body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to create upload URL";
      return internalServerError(message);
    }
  }

  if (head === "courses" && path.length === 1) {
    if (!body?.title || typeof body.title !== "string") {
      return badRequest("title is required");
    }

    if (body.startDate !== undefined && typeof body.startDate !== "string") {
      return badRequest("startDate must be a string");
    }

    if (body.endDate !== undefined && typeof body.endDate !== "string") {
      return badRequest("endDate must be a string");
    }

    if (body.capacity !== undefined && typeof body.capacity !== "number") {
      return badRequest("capacity must be a number");
    }

    try {
      const course = await createCourse({
        title: body.title,
        description: typeof body.description === "string" ? body.description : undefined,
        startDate: typeof body.startDate === "string" ? body.startDate : undefined,
        endDate: typeof body.endDate === "string" ? body.endDate : undefined,
        capacity: typeof body.capacity === "number" ? body.capacity : undefined,
      });
      return json(course, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid input";
      return badRequest(message);
    }
  }

  if (head === "courses" && tail && third === "sessions" && path.length === 3) {
    if (!body?.title || typeof body.title !== "string") {
      return badRequest("title is required");
    }

    if (body.visibility !== undefined && typeof body.visibility !== "string") {
      return badRequest("visibility must be a string");
    }

    if (body.startAt !== undefined && typeof body.startAt !== "string") {
      return badRequest("startAt must be a string");
    }

    if (body.endAt !== undefined && typeof body.endAt !== "string") {
      return badRequest("endAt must be a string");
    }

    try {
      const session = await createSession(tail, {
        title: body.title,
        description: typeof body.description === "string" ? body.description : undefined,
        visibility: typeof body.visibility === "string" ? body.visibility : undefined,
        startAt: typeof body.startAt === "string" ? body.startAt : undefined,
        endAt: typeof body.endAt === "string" ? body.endAt : undefined,
      });

      if (!session) {
        return notFound("Course not found");
      }

      return json(session, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid input";
      return badRequest(message);
    }
  }

  if (head === "materials" && path.length === 1) {
    if (!body?.sessionId || !body?.name || !body?.fileUrl || !body?.mimeType) {
      return badRequest("sessionId, name, fileUrl, and mimeType are required");
    }

    const material = await createMaterial(body);

    if (!material) {
      return notFound("Session not found");
    }

    return json(
      {
        id: material.id,
        status: material.status,
      },
      201,
    );
  }

  if (head === "recordings" && path.length === 1) {
    if (!body?.sessionId || !body?.name || !body?.fileUrl) {
      return badRequest("sessionId, name, and fileUrl are required");
    }

    const recording = await createRecording(body);

    return json(
      {
        id: recording.id,
        status: recording.status,
      },
      201,
    );
  }

  if (head === "qa") {
    if (!body?.sessionId || !body?.question) {
      return badRequest("sessionId and question are required");
    }

    return json(await getQaResponse(body));
  }

  if (head === "sessions" && tail && third === "quizzes") {
    const quiz = await createQuiz({
      sessionId: tail,
      sectionId: body?.sectionId ?? null,
      count: body?.count,
    });

    return json(
      {
        quizId: quiz.id,
        status: quiz.status,
      },
      201,
    );
  }

  if (head === "sessions" && tail && third === "quiz-generations") {
    const job = await startQuizGeneration({
      sessionId: tail,
      sectionId: body?.sectionId ?? null,
      count: body?.count,
    });

    return json(
      {
        jobId: job.id,
        status: job.status,
        quizId: job.quizId,
        error: job.error,
      },
      202,
    );
  }

  if (head === "quizzes" && tail && third === "attempts") {
    if (!body?.answers || !Array.isArray(body.answers)) {
      return badRequest("answers array is required");
    }

    const result = await submitQuizAttempt(tail, body);

    if (!result) {
      return notFound("Quiz not found");
    }

    return json(
      {
        attemptId: result.attemptId,
        score: result.score,
      },
      201,
    );
  }

  return notFound();
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  await ensureDemoSeeded();
  const { path = [] } = await context.params;
  const [head, tail, third, fourth] = path;
  const body = await readJsonBody(request);

  if (head === "recordings" && tail && third === "segments" && fourth) {
    const segment = await patchTranscriptSegment(tail, fourth, {
      refinedText: typeof body?.refinedText === "string" ? body.refinedText : undefined,
      sectionId: typeof body?.sectionId === "string" ? body.sectionId : undefined,
      pageNumber: typeof body?.pageNumber === "number" ? body.pageNumber : undefined,
    });

    if (!segment) {
      return notFound("Transcript segment not found");
    }

    return json(segment);
  }

  if (head === "courses" && tail && third === "enrollments" && path.length === 3) {
    try {
      const enrollment = await enrollCourse(tail);

      if (!enrollment) {
        return notFound("Course not found");
      }

      return json(enrollment, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "신청 실패";
      return badRequest(message);
    }
  }

  return notFound();
}
