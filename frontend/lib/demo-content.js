export const seedIds = {
  courseId: "course-ai-intro-01",
  sessionId: "session-ai-intro-01",
  materialId: "material-ai-intro-01",
  recordingId: "recording-ai-intro-01",
  quizId: "quiz-ai-intro-01",
  quizJobId: "job-ai-intro-01",
};

export function buildMaterialStructure(materialId, pageCount, title) {
  const sectionSpecs = [
    { title: "강의 개요", startPage: 1, endPage: Math.max(1, Math.min(3, pageCount)) },
    { title: "핵심 개념", startPage: 4, endPage: Math.max(4, Math.min(7, pageCount)) },
    { title: "실습 및 정리", startPage: 8, endPage: Math.max(8, pageCount) },
  ].filter((section) => section.startPage <= section.endPage);

  const sections = sectionSpecs.map((section, index) => ({
    id: `${materialId}-section-${index + 1}`,
    title: section.title,
    startPage: section.startPage,
    endPage: section.endPage,
  }));

  const pages = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const section = sections.find(
      (item) => pageNumber >= item.startPage && pageNumber <= item.endPage,
    );

    return {
      id: `${materialId}-page-${pageNumber}`,
      pageNumber,
      sectionId: section?.id ?? null,
      topicSentence: `${title} ${pageNumber}페이지 핵심 요약`,
      summary: `${title}의 ${pageNumber}페이지에는 데모용 학습 구조와 AI 해설이 정리되어 있습니다.`,
      keywords: ["AI", "학습", "데모", `P${pageNumber}`],
    };
  });

  return { sections, pages };
}

export function buildRecordingSegments(recordingId, sections) {
  return [
    {
      id: `${recordingId}-segment-1`,
      startMs: 0,
      endMs: 31000,
      rawText: "오늘은 강의자료 구조를 먼저 보고 핵심 목차를 정리합니다.",
      refinedText: "오늘은 강의자료 구조를 먼저 보고 핵심 목차를 정리합니다.",
      sectionId: sections[0]?.id ?? null,
      pageNumber: 1,
      mappingScore: 0.95,
    },
    {
      id: `${recordingId}-segment-2`,
      startMs: 31000,
      endMs: 62000,
      rawText: "그다음 녹화본 자막을 목차와 연결해 탐색 단위를 만듭니다.",
      refinedText: "그다음 녹화본 자막을 목차와 연결해 탐색 단위를 만듭니다.",
      sectionId: sections[1]?.id ?? null,
      pageNumber: 4,
      mappingScore: 0.92,
    },
    {
      id: `${recordingId}-segment-3`,
      startMs: 62000,
      endMs: 98000,
      rawText: "마지막으로 출처가 있는 QA와 퀴즈로 복습 흐름을 완성합니다.",
      refinedText: "마지막으로 출처가 있는 QA와 퀴즈로 복습 흐름을 완성합니다.",
      sectionId: sections[2]?.id ?? null,
      pageNumber: 8,
      mappingScore: 0.94,
    },
  ];
}

export function buildQuizQuestions(quizId, sectionId, count, materialId) {
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
      id: `${quizId}-question-${index + 1}`,
      questionText: `${index + 1}. ${template.questionText}`,
      choices: template.choices,
      answer: template.answer,
      explanation: template.explanation,
      sourcePageNumber: template.pageNumber,
      sourceSectionId: sectionId,
      sourceMaterialId: materialId,
    };
  });
}