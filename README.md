
```
# KIT-contest

공모전 제출용 AI 교육 서비스 MVP 저장소입니다.

## 디렉토리 개요

- `frontend`: Next.js 기반 웹 앱
- `backend/api`: API 서버 영역(구현 예정)
- `backend/worker`: PDF/STT/QA/퀴즈 AI 파이프라인 워커
- `docs`: 기획, MVP, 유저 플로우, 스키마, API 문서

## 현재 구조 (요약)

```text
KIT-contest
├─ backend
│  ├─ api
│  │  └─ README.md
│  └─ worker
│     ├─ app
│     ├─ requirements.txt
│     └─ tests
├─ docs
├─ frontend
│  ├─ app
│  ├─ public
│  ├─ package.json
│  └─ README.md
├─ .gitignore
└─ README.md
```

## 실행 경로

### 1) 프론트엔드

```bash
cd frontend
pnpm install
pnpm dev
```

배포 검증 기준:

```bash
cd frontend
pnpm build
```

### 2) 워커

```bash
cd backend/worker
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app/main.py
```

## 문서 우선 확인 순서

1. `docs/planning.md`
2. `docs/mvp.md`
3. `docs/user-flow.md`
4. `docs/schema.md`
5. `docs/ai-pipeline.md`
6. `docs/screen-architecture.md`
7. `docs/tech-stack.md`

```
```
KIT-contest
├─ backend
│  ├─ api
│  │  └─ README.md
│  ├─ README.md
│  └─ worker
│     ├─ app
│     │  ├─ config.py
│     │  ├─ constants.py
│     │  ├─ jobs
│     │  │  ├─ material_job.py
│     │  │  ├─ quiz_job.py
│     │  │  └─ recording_job.py
│     │  ├─ main.py
│     │  ├─ models
│     │  │  ├─ material.py
│     │  │  ├─ quiz.py
│     │  │  └─ recording.py
│     │  ├─ parsers
│     │  │  └─ pdf_parser.py
│     │  ├─ pipelines
│     │  │  ├─ pdf_orchestrator.py
│     │  │  ├─ pdf_pipeline.py
│     │  │  ├─ qa_pipeline.py
│     │  │  ├─ quiz_orchestrator.py
│     │  │  ├─ quiz_pipeline.py
│     │  │  ├─ stt_orchestrator.py
│     │  │  └─ stt_pipeline.py
│     │  ├─ services
│     │  │  ├─ db_service.py
│     │  │  ├─ embedding_service.py
│     │  │  ├─ llm_service.py
│     │  │  ├─ storage_service.py
│     │  │  └─ stt_service.py
│     │  └─ utils
│     │     ├─ demo_content.py
│     │     └─ __init__.py
│     ├─ README.md
│     ├─ requirements.txt
│     └─ tests
├─ docs
│  ├─ ai-pipeline.md
│  ├─ feature-priority.md
│  ├─ mvp.md
│  ├─ openapi.yaml
│  ├─ planning.md
│  ├─ schema.md
│  ├─ screen-architecture.md
│  ├─ tech-stack.md
│  └─ user-flow.md
├─ frontend
│  ├─ AGENTS.md
│  ├─ app
│  │  ├─ api
│  │  │  └─ [...path]
│  │  │     └─ route.ts
│  │  ├─ components
│  │  │  ├─ pdf-viewer.tsx
│  │  │  ├─ session-learning-view.tsx
│  │  │  └─ video-player.tsx
│  │  ├─ dashboard
│  │  │  ├─ courses
│  │  │  │  └─ [courseId]
│  │  │  │     └─ page.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ sessions
│  │  │     └─ [sessionId]
│  │  │        └─ page.tsx
│  │  ├─ favicon.ico
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ CLAUDE.md
│  ├─ components
│  │  ├─ course-card.tsx
│  │  ├─ course-detail-shell.tsx
│  │  ├─ dashboard-shell.tsx
│  │  ├─ home-shell.tsx
│  │  ├─ pdf-viewer.tsx
│  │  ├─ role-select-modal.tsx
│  │  ├─ session-detail-shell.tsx
│  │  ├─ session-learning-view.tsx
│  │  └─ video-player.tsx
│  ├─ eslint.config.mjs
│  ├─ lib
│  │  ├─ api-store.ts
│  │  ├─ demo-content.d.ts
│  │  ├─ demo-content.js
│  │  ├─ demo-store.ts
│  │  ├─ prisma-store.ts
│  │  ├─ prisma.ts
│  │  ├─ supabase-admin.ts
│  │  ├─ ui-constants.ts
│  │  └─ user-role.ts
│  ├─ next.config.ts
│  ├─ package.json
│  ├─ pnpm-lock.yaml
│  ├─ pnpm-workspace.yaml
│  ├─ postcss.config.mjs
│  ├─ prisma
│  │  ├─ dev.db
│  │  ├─ schema.introspect.prisma
│  │  ├─ schema.postgres.prisma
│  │  ├─ schema.prisma
│  │  └─ seed.mjs
│  ├─ prisma.config.ts
│  ├─ public
│  │  ├─ file.svg
│  │  ├─ globe.svg
│  │  ├─ next.svg
│  │  ├─ vercel.svg
│  │  └─ window.svg
│  ├─ README.md
│  └─ tsconfig.json
└─ README.md

```