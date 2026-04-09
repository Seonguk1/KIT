import { PrismaClient } from "@prisma/client";
import {
  buildMaterialStructure,
  buildQuizQuestions,
  buildRecordingSegments,
} from "../lib/demo-content.js";

const prisma = new PrismaClient();

const seedIds = {
  courseId: "course-ai-intro-01",
  sessionId: "session-ai-intro-01",
  materialId: "material-ai-intro-01",
  recordingId: "recording-ai-intro-01",
  quizId: "quiz-ai-intro-01",
  quizJobId: "job-ai-intro-01",
};

async function seed() {
  const now = new Date();

  await prisma.course.upsert({
    where: { id: seedIds.courseId },
    update: {},
    create: {
      id: seedIds.courseId,
      title: "AI 교육 플랫폼 데모",
      description: "강의자료, 녹화본, QA, 퀴즈를 연결하는 샘플 과정",
      status: "open",
    },
  });

  await prisma.session.upsert({
    where: { id: seedIds.sessionId },
    update: {},
    create: {
      id: seedIds.sessionId,
      courseId: seedIds.courseId,
      title: "1주차: 자료 구조화와 질의응답",
      description: "샘플 세션",
      orderIndex: 1,
      visibility: "published",
    },
  });

  const structure = buildMaterialStructure(seedIds.materialId, 12, "AI 학습 플랫폼 개론");
  const sections = structure.sections;
  const pages = structure.pages;

  await prisma.material.upsert({
    where: { id: seedIds.materialId },
    update: {},
    create: {
      id: seedIds.materialId,
      sessionId: seedIds.sessionId,
      type: "lecture_pdf",
      name: "AI 학습 플랫폼 개론.pdf",
      fileUrl: "https://storage.demo/files/ai-intro.pdf",
      mimeType: "application/pdf",
      pageCount: 12,
      isLocked: false,
      extractEnabled: true,
      processingStatus: "completed",
      analysisSummary: "강의 개요, 핵심 개념, 실습 정리로 구성된 3단계 목차를 추출했습니다.",
      tocStatus: "completed",
      pageCountAnalyzed: 12,
      lastProcessedAt: now,
    },
  });

  for (const section of sections) {
    await prisma.materialSection.upsert({
      where: { id: section.id },
      update: {},
      create: {
        id: section.id,
        materialId: seedIds.materialId,
        parentSectionId: null,
        title: section.title,
        level: 1,
        startPage: section.startPage,
        endPage: section.endPage,
        orderIndex: section.startPage,
      },
    });
  }

  for (const page of pages) {
    await prisma.materialPage.upsert({
      where: { id: page.id },
      update: {},
      create: {
        id: page.id,
        materialId: seedIds.materialId,
        pageNumber: page.pageNumber,
        sectionId: page.sectionId,
        topicSentence: page.topicSentence,
        summary: page.summary,
        keywords: page.keywords,
        embeddingStatus: "completed",
      },
    });
  }

  await prisma.recording.upsert({
    where: { id: seedIds.recordingId },
    update: {},
    create: {
      id: seedIds.recordingId,
      sessionId: seedIds.sessionId,
      name: "AI 학습 플랫폼 개론 - 녹화본.mp4",
      fileUrl: "https://storage.demo/files/ai-intro-recording.mp4",
      durationSeconds: 1080,
      language: "ko",
      sttEnabled: true,
      sttStatus: "completed",
      subtitleUrl: "https://storage.demo/files/ai-intro-recording.vtt",
    },
  });

  for (const segment of buildRecordingSegments(seedIds.recordingId, sections)) {
    await prisma.transcriptSegment.upsert({
      where: { id: segment.id },
      update: {},
      create: {
        id: segment.id,
        recordingId: seedIds.recordingId,
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

  const quizSectionId = sections[1]?.id ?? sections[0]?.id ?? null;

  await prisma.quiz.upsert({
    where: { id: seedIds.quizId },
    update: {},
    create: {
      id: seedIds.quizId,
      sessionId: seedIds.sessionId,
      materialId: seedIds.materialId,
      sectionId: quizSectionId,
      title: "AI 학습 플랫폼 개론 퀴즈",
      generatedBy: "ai",
      status: "draft",
    },
  });

  for (const question of buildQuizQuestions(seedIds.quizId, quizSectionId, 3, seedIds.materialId)) {
    await prisma.quizQuestion.upsert({
      where: { id: question.id },
      update: {},
      create: {
        id: question.id,
        quizId: seedIds.quizId,
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

  await prisma.quizGenerationJob.upsert({
    where: { id: seedIds.quizJobId },
    update: {},
    create: {
      id: seedIds.quizJobId,
      sessionId: seedIds.sessionId,
      status: "completed",
      quizId: seedIds.quizId,
      error: null,
      count: 3,
      sectionId: quizSectionId,
    },
  });
}

seed()
  .then(async () => {
    console.log("Demo seed completed");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
