export const USER_ROLE = {
  TEACHER: "teacher",
  STUDENT: "student",
} as const;

export const ROLE_LABELS = {
  teacher: "강사",
  student: "수강생",
} as const;

export const ROLE_DESCRIPTIONS = {
  teacher: "강의자료, 녹화본, 퀴즈를 관리하고 공개 흐름을 확인합니다.",
  student: "세션 자료, 영상, 챗봇, 퀴즈를 하나의 학습 흐름으로 봅니다.",
} as const;

export const STATUS_LABELS = {
  uploaded: "업로드됨",
  queued: "대기중",
  processing: "처리중",
  transcribing: "전사중",
  post_processing: "후처리중",
  completed: "완료",
  failed: "실패",
} as const;

export const COURSE_STATUS_LABELS = {
  draft: "초안",
  open: "진행중",
  closed: "종료",
  archived: "보관됨",
} as const;

export const SESSION_VISIBILITY_LABELS = {
  draft: "비공개",
  published: "공개",
  hidden: "숨김",
} as const;

export const DASHBOARD_COPY = {
  title: "강의 대시보드",
  description: "강의 카드에서 상세로 들어가 세션과 학습 흐름을 확인합니다.",
  teacherAction: "새 강의 만들기",
  emptyTitle: "등록된 강의가 없습니다",
  emptyDescription: "강사가 새 강의를 만들면 카드가 이 영역에 표시됩니다.",
} as const;

export const HOME_COPY = {
  eyebrow: "KIT-contest MVP",
  title: "강의자료, 녹화본, QA, 퀴즈를 하나의 학습 흐름으로 묶습니다.",
  description:
    "강사와 수강생이 같은 세션 안에서 자료, 영상, 질문, 퀴즈를 바로 이어서 볼 수 있도록 설계했습니다.",
} as const;
