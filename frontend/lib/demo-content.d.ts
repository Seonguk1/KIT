export type SeedIds = {
  courseId: string;
  sessionId: string;
  materialId: string;
  recordingId: string;
  quizId: string;
  quizJobId: string;
};

export type DemoSection = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
};

export type DemoPage = {
  id: string;
  pageNumber: number;
  sectionId: string | null;
  topicSentence: string;
  summary: string;
  keywords: string[];
};

export type DemoSegment = {
  id: string;
  startMs: number;
  endMs: number;
  rawText: string;
  refinedText: string;
  sectionId: string | null;
  pageNumber: number | null;
  mappingScore: number;
};

export type DemoQuestion = {
  id: string;
  questionText: string;
  choices: string[];
  answer: string;
  explanation: string;
  sourcePageNumber: number;
  sourceSectionId: string | null;
  sourceMaterialId: string;
};

export declare const seedIds: SeedIds;

export declare function buildMaterialStructure(
  materialId: string,
  pageCount: number,
  title: string,
): { sections: DemoSection[]; pages: DemoPage[] };

export declare function buildRecordingSegments(
  recordingId: string,
  sections: DemoSection[],
): DemoSegment[];

export declare function buildQuizQuestions(
  quizId: string,
  sectionId: string | null,
  count: number,
  materialId: string,
): DemoQuestion[];