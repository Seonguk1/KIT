# 프로젝트 기획서

## 0. 공모전 전제 및 개발 목표

본 프로젝트는 KIT 바이브코딩 공모전 제출을 목표로 하는 웹 기반 AI 교육 솔루션이다.
최종적으로 public GitHub 저장소와 배포 가능한 라이브 URL을 제출할 수 있도록,
기획 단계부터 실제 구현 가능한 범위의 MVP를 기준으로 설계한다.

본 프로젝트는 단순 LMS 구축이 아니라,
강사와 수강생의 실제 교육 현장 문제를 AI 기술로 해결하는 것을 목표로 한다.
따라서 기능 수를 늘리는 것보다,
핵심 사용자 흐름이 실제 웹 서비스에서 안정적으로 동작하는 것을 우선한다.

## 1. 프로젝트 개요

### 프로젝트명
가칭: **강의자료·녹화본 기반 AI 학습 플랫폼**

### 한 줄 소개
강의자료(PDF)와 녹화본을 업로드하면 AI가 목차, 자막, 퀴즈, 근거형 챗봇을 자동 생성하여  
강사는 강의를 통합 관리하고, 수강생은 자료·영상·질문·퀴즈를 하나의 학습 흐름에서 활용할 수 있는 교육 플랫폼이다.

---

## 2. 기획 배경

기존의 교육 플랫폼은 강의자료, 녹화본, 퀴즈, 질의응답, 학습 현황이 각각 분리되어 있는 경우가 많다.  
이로 인해 강사는 여러 도구를 오가며 강의를 운영해야 하고, 수강생은 학습 도중 필요한 정보를 찾기 위해 자료와 영상을 반복적으로 탐색해야 한다.

특히 다음과 같은 문제가 존재한다.

### 강사 입장
- 강의자료, 녹화본, 퀴즈, 과제, 수강생 현황을 각각 따로 관리해야 한다.
- PDF 자료를 올려도 단순 파일 저장에 그쳐, 학습용 구조 정보로 재활용되지 않는다.
- 녹화본 자막을 직접 정리하거나 품질을 관리하기 어렵다.
- 강의자료를 기반으로 한 질의응답 환경을 별도로 제공하기 어렵다.

### 수강생 입장
- 강의자료와 녹화본이 연결되어 있지 않아 필요한 구간을 빠르게 찾기 어렵다.
- 강의 영상에서 현재 내용이 어느 목차에 해당하는지 알기 어렵다.
- 학습 중 생기는 질문에 대해 신뢰 가능한 답변을 바로 얻기 어렵다.
- 퀴즈와 복습 포인트가 자동화되어 있지 않아 자기주도 학습 효율이 떨어진다.

---

## 3. 문제 정의

본 프로젝트는 다음 문제를 해결하고자 한다.

1. 강의자료와 녹화본이 서로 단절되어 있어 학습 탐색 비용이 크다.
2. 강의 운영에 필요한 정보가 통합되지 않아 강사의 관리 부담이 높다.
3. 교육용 챗봇이 강의 근거 없이 답변할 경우 신뢰성이 떨어진다.
4. 수강생이 강의 핵심 내용을 빠르게 복습하고 점검할 수단이 부족하다.

---

## 4. 해결 방안

본 서비스는 강의자료와 녹화본을 AI로 구조화하여,  
강의 운영과 학습 경험을 동시에 개선하는 것을 목표로 한다.

### 핵심 아이디어
- 강사가 강의를 생성하고 세션별로 자료를 업로드한다.
- PDF 강의자료에서 텍스트를 추출하고, 목차/페이지/주제문/키워드를 구조화한다.
- 녹화본을 업로드하면 STT를 통해 자막을 생성하고, 강의자료를 활용해 전문용어를 보정한다.
- 자막의 타임스탬프와 강의자료의 목차를 연결하여 수강생이 내용 단위로 탐색할 수 있게 한다.
- 강의자료 내용을 기반으로 답변하는 챗봇을 제공하여 신뢰성을 높인다.
- 목차별 퀴즈를 자동 생성하여 복습을 돕는다.

---

## 5. 주요 사용자

### 1) 강사
- 강의 및 세션 생성
- 강의자료 업로드 및 관리
- 녹화본 업로드 및 자막 생성
- 퀴즈/과제/수강생 현황 관리

### 2) 수강생
- 강의 신청 및 수강
- 강의자료 열람
- 녹화본 시청 및 자막 활용
- 목차 기반 탐색
- 챗봇 질의응답
- 퀴즈 풀이

---

## 6. 주요 기능

### 강사용 기능
- 강의 생성 및 세션 관리
- PDF 강의자료 업로드
- 자료 구조 분석
  - 목차 추출
  - 페이지별 주제문 생성
  - 핵심 키워드 추출
  - 페이지-목차 매핑
- 녹화본 업로드
- STT 자막 생성 및 후보정
- 세션별 자료 공개/비공개 관리
- 퀴즈 생성 및 관리
- 수강생 학습 현황 확인

### 수강생용 기능
- 강의 목록 확인 및 신청
- 세션별 강의자료 열람
- 영상 플레이어로 녹화본 시청
- 자막 확인
- 목차 클릭 시 관련 페이지/타임스탬프 이동
- 강의자료 기반 챗봇 질문
- 퀴즈 풀이 및 결과 확인

---

## 7. 서비스 차별점

### 1) 강의자료와 녹화본의 통합 구조화
일반적인 LMS는 PDF와 동영상이 별개로 존재하지만,  
본 서비스는 자료의 목차와 영상의 타임스탬프를 연결하여 하나의 학습 구조로 통합한다.

### 2) 강의자료 기반 자막 보정
단순 STT 결과를 그대로 사용하는 것이 아니라,  
강의자료에 포함된 전문용어와 핵심 내용을 반영해 자막 정확도를 향상시킨다.

### 3) 근거형 챗봇
챗봇이 강의자료와 자막 내용을 기반으로만 답변하도록 하여  
교육 환경에서 중요한 신뢰성을 확보한다.

### 4) 복습 자동화
목차 단위 퀴즈 생성 및 구조화된 자료 탐색을 통해  
수강생의 자기주도 학습 효율을 높인다.

---

## 8. 기대 효과

### 강사
- 강의 운영 및 자료 관리 효율 향상
- 자막/퀴즈/자료 구조화 자동화로 준비 시간 절감
- 수강생 질문 대응 부담 완화

### 수강생
- 원하는 학습 내용을 빠르게 탐색 가능
- 강의자료와 영상의 연결로 복습 효율 상승
- 근거 기반 답변을 통한 신뢰성 있는 학습 지원

### 교육 운영 측면
- 강의 콘텐츠 재사용성 향상
- 온라인/오프라인 혼합 학습 환경에 적용 가능
- 향후 대학 수업, 사내 교육, 부트캠프 등으로 확장 가능

---

## 9. 프로젝트 목표

본 프로젝트의 목표는 단순 강의 업로드 플랫폼을 만드는 것이 아니라,  
**강의자료와 녹화본을 AI로 구조화하여 강의 운영과 학습 경험을 동시에 혁신하는 것**이다.

우리는 다음을 달성하고자 한다.

- 강의자료 기반의 지능형 강의 관리
- 영상 시청 경험의 구조화
- 신뢰성 있는 교육용 AI 질의응답
- 자동화된 복습 지원
- 강사와 수강생 모두에게 실질적인 가치 제공

---

## 10. 핵심 가치 요약

- **통합성**: 자료, 영상, 자막, 퀴즈, 챗봇을 하나의 흐름으로 연결
- **신뢰성**: 강의자료 기반 답변과 자막 후보정
- **효율성**: 강사의 운영 부담 감소, 수강생의 탐색 비용 감소
- **확장성**: 대학, 사내교육, 부트캠프 등 다양한 교육 환경에 적용 가능

## 11. API 계약 초안 (요약)

다음은 MVP 구현을 위한 최소 API 계약 초안입니다. 엔드포인트는 프론트엔드 화면과의 매핑 및 폴링 지점을 고려하여 설계했습니다.

핵심 엔드포인트(예)
- `POST /api/upload-urls` — 파일 업로드용 signed URL 발급
  - Request: `{ "fileName":string, "contentType":string, "purpose":"material"|"recording" }`
  - Response: `{ "uploadUrl":string, "fileUrl":string, "expiresAt":string }`

- `POST /api/materials` — 업로드 후 메타데이터 생성
  - Request: `{ "sessionId":string, "name":string, "fileUrl":string, "mimeType":string, "pageCount":number, "extractEnabled":boolean, "type":"lecture_pdf"|... }`
  - Response: `201 { "id":string, "processingStatus":"uploaded"|"queued"|"processing"|"completed"|"failed", ... }`

- `GET /api/materials/{materialId}` — 자료 메타 + 처리 상태
  - Response: `{ "id":string, "processingStatus":..., "analysis": { "analysisSummary":string, "tocStatus":"pending"|"completed"|"failed", "pageCountAnalyzed":number, "lastProcessedAt":string } }`

- `GET /api/materials/{materialId}/sections` — 목차/섹션 목록
  - Response: `{ "sections": [ {"id", "title", "startPage", "endPage"} ] }`

- `GET /api/materials/{materialId}/pages` — 페이지 분석 결과 목록
  - Response: `{ "pages": [ {"pageNumber", "sectionId", "topicSentence", "summary", "keywords"} ] }`

- `POST /api/recordings` — 녹화본 메타 생성
  - Request: `{ "sessionId":string, "name":string, "fileUrl":string, "durationSeconds":number, "language":string, "sttEnabled":boolean }`
  - Response: `201 { "id":string, "sttStatus":"uploaded"|"queued"|"transcribing"|"post_processing"|"completed"|"failed" }`

- `GET /api/recordings/{recordingId}` — 녹화본 메타 + 상태
  - Response: `{ "id":string, "sttStatus":..., "subtitleUrl":string, ... }`

- `GET /api/recordings/{recordingId}/segments` — 자막 세그먼트 목록
  - Query(optional): `sectionId`, `pageNumber`, `cursor`, `limit`
  - Response: `{ "items": [ {"id", "startMs", "endMs", "rawText", "refinedText", "sectionId", "pageNumber", "mappingScore"} ], "nextCursor":string|null }`

- `PATCH /api/recordings/{recordingId}/segments/{segmentId}` — 자막/매핑 수정
  - Request: `{ "refinedText"?:string, "sectionId"?:string, "pageNumber"?:number }`
  - Response: `{ "id", "startMs", "endMs", "rawText", "refinedText", "sectionId", "pageNumber", "mappingScore" }`

- `POST /api/qa` — 동기 질의응답 (프론트챗 패널에서 사용)
  - Request: `{ "sessionId":string, "question":string, "topK":number (optional) }`
  - Response: `200 { "answer":string, "sourceRefs":[ {"materialId":string,"sectionId":string,"pageNumber":number,"startMs":number,"endMs":number,"snippet":string,"score":number} ], "confidence":number }`
  - Errors: `400`(invalid input), `503`(upstream error), `504`(timeout)

- `POST /api/sessions/{sessionId}/quizzes` — 퀴즈 동기 생성(소량 권장)
  - Request: `{ "sectionId":string, "count":number (1~10 권장) }`
  - Response: `201 { "quizId":string, "status":"draft" }`

- `POST /api/sessions/{sessionId}/quiz-generations` — 퀴즈 비동기 생성 잡 시작
  - Request: `{ "sectionId":string, "count":number }`
  - Response: `202 { "jobId":string, "status":"queued"|"processing"|"completed"|"failed", "quizId":string|null, "error":string|null }`

- `GET /api/quiz-generations/{jobId}` — 퀴즈 생성 잡 상태 조회
  - Response: `200 { "jobId":string, "status":"queued"|"processing"|"completed"|"failed", "quizId":string|null, "error":string|null }`

- `POST /api/quizzes/{quizId}/publish` — 강사 승인 후 공개
  - Response: `200 { "quizId":string, "status":"published" }`

공통 오류 응답 형태
```
{ "error": { "code": "INVALID_INPUT"|"NOT_FOUND"|"UPSTREAM_ERROR"|"TIMEOUT", "message": "...", "details": {...} } }
```

상태 enum(요약)
- materials.processingStatus: `uploaded` → `queued` → `processing` → `completed` / `failed`
- recordings.sttStatus: `uploaded` → `queued` → `transcribing` → `post_processing` → `completed` / `failed`
- quizzes.status: `draft` → `published` / `hidden`

폴링/타임아웃 가이드
- 프론트엔드는 `GET /api/materials/{id}` 또는 `/status`를 폴링(권장 5초)하여 처리 진행을 표시합니다.
- QA 동기 응답 타임아웃은 서비스 레이어에서 20~30초 내로 제한하고, 타임아웃 시 명확한 사용자 메시지를 반환합니다.

자세한 엔드포인트 및 예시는 `docs/screen-architecture.md`의 API 매핑 섹션에 포함합니다.