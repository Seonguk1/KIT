# AI Worker

이 디렉토리는 PDF 구조화, STT, QA, 퀴즈 생성 등
장시간 AI 처리 파이프라인을 담당한다.

## 원칙
- 웹 프레임워크와 강하게 결합하지 않는다.
- 상태 기반 비동기 처리 전제를 따른다.
- 현재 워커는 Postgres(`DATABASE_URL` 또는 `WORKER_DATABASE_URL`)의 `Material`, `Recording`, `QuizGenerationJob`을 폴링한다.
- `jobs`는 상태 전이와 처리 흐름, `services`는 DB 접근, `constants`는 상태값과 테이블명을 담당한다.
- PDF는 `jobs/material_job.py -> pipelines/pdf_orchestrator.py -> pipelines/pdf_pipeline.py` 순으로 호출된다.
- 오케스트레이터 파일은 단계 호출 순서를 한 눈에 보여주고, 상세 구현은 파이프라인 함수로 캡슐화한다.
- 오케스트레이터는 각 단계 시작 시 `stage=<단계명>` 로그를 남기며, 실패 시 마지막 단계명을 포함해 예외를 기록한다.
- PDF 파이프라인 내부에서 `services/storage_service.py`로 파일 바이트를 다운로드하고, `parsers/pdf_parser.py`로 페이지 텍스트/신호를 추출한다.
- STT는 `jobs/recording_job.py -> pipelines/stt_orchestrator.py -> pipelines/stt_pipeline.py` 순으로 호출된다.
- 퀴즈는 `jobs/quiz_job.py -> pipelines/quiz_orchestrator.py -> pipelines/quiz_pipeline.py` 순으로 호출된다.
- STT 파이프라인은 OpenAI STT/LLM 호출을 시도하고, 호출 실패 시 데모 세그먼트로 fallback한다.

## 실행 예시
가상환경 활성화 후:

```bash
python app/main.py --once
python app/main.py
```

---

## 환경 변수

- `WORKER_DATABASE_URL`: 워커 전용 Postgres URL. 미지정 시 `DATABASE_URL`을 사용한다.
- `WORKER_POLL_INTERVAL_SECONDS`: 폴링 간격. 기본값은 5초다.
- `WORKER_BATCH_SIZE`: 한 번에 처리할 작업 수. 기본값은 5다.
- `OPENAI_API_KEY`: STT/LLM 후보정 호출에 사용한다. 미설정 시 STT는 fallback 경로로 동작한다.
- `WORKER_STT_MODEL`: STT 모델명. 기본값은 `gpt-4o-mini-transcribe`다.
- `WORKER_LLM_MODEL`: 자막 후보정 모델명. 기본값은 `gpt-4o-mini`다.

---

## 현재 동작

- 자료 상태: `uploaded` -> `queued` -> `processing` -> `completed` / `failed`
- 녹화본 상태: `uploaded` -> `queued` -> `transcribing` -> `post_processing` -> `completed` / `failed`
- 퀴즈 생성 작업: `queued` -> `processing` -> `completed` / `failed`
