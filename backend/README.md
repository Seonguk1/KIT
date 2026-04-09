# Backend

백엔드는 `api`와 `worker`로 분리되어 있습니다.

## 구성

- `api`: 클라이언트 요청을 처리하는 API 서버 영역
- `worker`: 장시간 AI 파이프라인(PDF/STT/QA/퀴즈) 처리 영역

## 현재 상태

- `api`: 프론트엔드 Route Handler에서 호출하는 저장/조회 로직과 연동됨
- `worker`: SQLite DB 폴링 기반으로 자료/녹화본/퀴즈 작업 상태 전이 처리 가능

## 워커 실행

```bash
cd worker
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app/main.py --once
python app/main.py
```

## 비고

- 기본 DB 경로는 `frontend/prisma/dev.db`입니다.
- 워커 시작 전 프론트엔드에서 `db:push`, `db:seed`를 먼저 수행해야 합니다.
