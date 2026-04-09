# 기술 스택 (확정안)

## 0. 현재 구현 스냅샷 (2026-04-08)

아래 항목은 "목표 스택"과 별개로, 현재 저장소에서 실제 동작 검증한 구현 기준입니다.

- API 엔드포인트: Next.js Route Handlers (`frontend/app/api/[...path]/route.ts`)
- 데이터 접근: Prisma Client (`frontend/lib/prisma-store.ts`)
- 개발/운영 DB: Supabase PostgreSQL (`kit_contest` 스키마)
- 파일 업로드: Supabase Storage signed upload URL (`/api/upload-urls`)
- 시드: idempotent upsert 기반 (`frontend/prisma/seed.mjs`)
- 백그라운드 처리: Python worker PostgreSQL 폴링 (`backend/worker/app/main.py`)
- 워커 작업: `Material` / `Recording` / `QuizGenerationJob` 상태 전이

현재 기준으로 워커 단일 사이클 실행과 시드 완료를 확인했습니다.

## 1. 결정 목적

본 문서는 공모전 MVP를 실제로 끝까지 구현하기 위한 **확정 기술 스택**을 정의한다.
이 문서의 기준일은 2026-04-07이며, 별도 의사결정 기록이 없으면 아래 스택을 기본값으로 사용한다.

핵심 기준은 다음 4가지다.
1. P0 기능을 가장 빠르게 완성할 수 있는가
2. 업로드/비동기 처리/AI 연동을 안정적으로 운영할 수 있는가
3. 목차-페이지-자막-챗봇-퀴즈의 데이터 흐름을 일관되게 유지할 수 있는가
4. 배포 데모에서 장애 포인트를 최소화할 수 있는가

---

## 2. 최종 확정 스택

### 애플리케이션 구조 (재작성 최소화 원칙)
- **사용자-facing 계층**: Next.js App Router + Route Handlers
- **AI 처리 계층**: 별도 Python worker 프로세스
- 핵심 원칙: 웹 요청 처리와 장시간 AI 작업을 분리해, 프레임워크 선택 변경 시에도 UI/API를 재사용한다.

### Frontend
- **Next.js 14+ (App Router)**
- **TypeScript**
- **Tailwind CSS**
- 상태/서버 데이터: **@tanstack/react-query**
- 로컬 UI 상태: **zustand**
- 폼: **react-hook-form**
- PDF 뷰어: **react-pdf**
- 비디오 플레이어: **HTML5 video (기본)**

### Backend
- **Next.js Route Handlers**: 사용자 요청 처리(CRUD, 상태 조회, 챗/퀴즈 트리거)
- **인증**: MVP에서는 로그인 미구현, 역할 선택(강사/수강생) 기반 데모 플로우 사용
- **업로드**: 서버 경유 업로드가 아니라 direct-to-storage signed URL 방식
- **장시간 작업 처리 금지**: Route Handlers 내부에서 PDF 구조화/STT/임베딩 생성을 동기 처리하지 않는다.

### Database
- 현재 구현: **SQLite + Prisma ORM**
- 목표 운영 스택: **Supabase PostgreSQL + Prisma ORM + pgvector**

### Storage
- 현재 구현: Supabase Storage signed upload URL 기반 direct upload
- 목표 운영 스택: **Supabase Storage**
- 저장 대상: PDF, 녹화본, 생성 자막 파일

### AI / 데이터 처리
- 실행 위치: Python worker
- PDF 텍스트 추출: PyMuPDF
  - 기본: block 단위 추출
  - 보조: word / plain text
  - 텍스트 부족 페이지는 OCR 후보 분기
- STT: OpenAI Audio API
  - 기본: `gpt-4o-transcribe`
  - 대안: `gpt-4o-mini-transcribe`
  - 화자 분리 필요 시: `gpt-4o-transcribe-diarize`
  - 긴 녹화본은 청크 분할 후 병합
- LLM: `gpt-5.4-mini`
  - 용도: 목차 보조 추출, 페이지 요약/키워드, QA, 퀴즈 생성, 자막 후보정
  - 출력 방식: Structured Outputs / function calling 기반 스키마 강제
- 원칙: AI 파이프라인 코드는 웹 프레임워크 의존 없이 모듈화한다.

### 비동기 처리
- **DB 상태값 + Polling 방식 확정**
- 상태 전이 예시:
  - materials: uploaded -> queued -> processing -> completed/failed
  - recordings: uploaded -> queued -> transcribing -> post_processing -> completed/failed
- MVP에서는 DB 기반 job 관리 + worker polling으로 시작
- 큐 시스템은 즉시 고정하지 않고, 동시성/재시도 요구가 커질 때 Redis/BullMQ/Celery로 확장한다.

### 검색 / RAG
- 임베딩 저장: **material_pages + transcript_segments**
- 검색 순서:
  1. 질의 임베딩 생성
  2. pgvector 유사도 검색
  3. 상위 컨텍스트 결합
  4. LLM 답변 생성
  5. 출처(page/section/timestamp) 반환

### 배포
- 현재 구현: 로컬 실행 및 빌드/시드/워커 검증
- 목표 운영 스택: 애플리케이션 **Vercel**, DB/Storage **Supabase**

### 로깅/모니터링
- 1차: 애플리케이션 로그 + 처리 상태 로그(DB)
- 2차(선택): Sentry

---

## 3. 대안 제외 결정

### 프레임워크 올인 금지 결정

본 프로젝트의 핵심 리스크는 "Next.js vs FastAPI" 자체보다 **AI 파이프라인을 웹 요청과 강결합하는 설계**다.

따라서 다음을 확정한다.
1. 사용자-facing 계층은 Next.js로 고정한다.
2. 장시간 AI 작업(PDF 구조화/STT/임베딩/후보정)은 Python worker로 분리한다.
3. FastAPI는 초기 필수 요소로 고정하지 않으며, Python 처리 계층의 API 분리가 필요해질 때 별도 서비스로 도입한다.

이 결정의 목적은 "지금 잘못 골라도 전체 재작성으로 가지 않는 구조"를 확보하는 것이다.

---

### NestJS 미채택 (현재 단계)
- 이유: 공모전 MVP에서는 서버 분리보다 구현 속도/통합 디버깅이 중요함
- 결정: 사용자-facing 계층은 Next.js 유지, 서버 분리는 MVP 이후 재평가

### 별도 벡터 DB 미채택
- 이유: 현재 검색 스케일은 pgvector로 충분하며 운영 복잡도 감소 효과가 큼
- 결정: pgvector 고정, 검색 품질/성능 한계 확인 시 재평가

### 메시지 큐 미채택
- 이유: P0에서는 DB 상태 + worker polling으로 데모 흐름 충족 가능
- 결정: 실패 재시도/우선순위/동시성 요구가 커질 때 큐를 도입

---

## 4. 구현 고정 원칙

1. P0 완성 전 사용자-facing 계층은 Next.js로 유지한다.
2. 대용량 업로드는 direct-to-storage로 처리한다.
3. AI 작업은 HTTP 요청 안에서 끝내지 않고 job + worker로 처리한다.
4. AI 응답은 반드시 출처(page/section/timestamp)를 포함한다.
5. 비동기 작업은 모든 단계에서 상태 전이를 기록한다.
6. 문서에 없는 신규 기술 도입은 사전 합의 후 진행한다.

---

## 5. 재검토 트리거

아래 조건 중 **2개 이상** 동시 발생 시 FastAPI 별도 서비스 도입을 재검토한다.

| 트리거 | 판정 기준 | 재평가 대상 |
|--------|----------|-----------|
| **Python 내부 API 증가** | worker 내부 기능이 5개 이상 API로 노출 필요 | FastAPI 서비스화 |
| **운영 요구 증가** | 재시도 정책, 우선순위 큐, 모니터링 대시보드 필요 | 큐 + FastAPI 운영 계층 |
| **배포 분리 필요** | AI 처리 배포 주기를 웹과 분리해야 함 | FastAPI 별도 배포 |
| **팀 구조 변화** | Python 백엔드 전담 인력이 생김 | FastAPI 책임 분리 |
| **처리량 증가** | 동시 job 처리량이 현 구조 한계 도달 | 큐/워커 확장 + API 분리 |

**재검토 시점**: MVP 완성 직후, P1 기능 착수 전


---

## 6. 참고 문서

- 전체 기획: docs/planning.md
- MVP 범위: docs/mvp.md
- 기능 우선순위: docs/feature-priority.md
- 데이터 설계: docs/schema.md
- AI 파이프라인: docs/ai-pipeline.md
- 화면 구조: docs/screen-architecture.md
- 사용자 흐름: docs/user-flow.md
