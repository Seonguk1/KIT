# Frontend

공모전 데모용 웹 UI(Next.js)입니다.

## 실행

```bash
pnpm install
pnpm dev
```

개발 서버 기본 주소: `http://localhost:3000`

## 빌드 검증

```bash
pnpm build
```

공모전 제출 전에는 `pnpm build` 통과를 기준으로 확인합니다.

## 데이터베이스(Prisma)

현재 기본 DB는 Postgres(`prisma/schema.postgres.prisma`)입니다.
권장 연결 방식은 Supabase `public` 직접 사용이 아니라 전용 스키마(`kit_contest`) 분리입니다.

```bash
pnpm db:push
pnpm db:seed
```

초기화 후 재시딩이 필요하면:

```bash
pnpm db:reset
```

주의: `prisma db pull`은 앱 스키마를 덮어쓸 수 있으므로 아래 전용 스크립트를 사용하세요.

```bash
pnpm prisma:dbpull:introspect
```

이 명령은 `prisma/schema.introspect.prisma`만 갱신하며, 앱 스키마(`prisma/schema.postgres.prisma`)는 유지됩니다.

### Postgres 전환 템플릿

배포 환경에서 Postgres를 사용할 때는 아래 스크립트를 사용합니다.

1) `.env.example`을 복사해 `.env.local`을 만들고 `DATABASE_URL`을 Supabase 값으로 채웁니다.

```bash
cp .env.example .env.local
```

2) 필요 시 터미널 환경 변수로도 동일 값을 지정할 수 있습니다.

```bash
pnpm prisma:validate:postgres
pnpm prisma:generate:postgres
pnpm db:push:postgres
pnpm db:migrate:dev:postgres
pnpm db:migrate:deploy:postgres
```

`DATABASE_URL` 환경 변수를 먼저 설정해야 합니다.

예시:

```bash
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:5432/postgres?schema=kit_contest"
```

Supabase 권한 최소화(권장):

```bash
npx dotenv -e .env.local -- prisma db execute --schema=prisma/schema.postgres.prisma --stdin <<'SQL'
CREATE SCHEMA IF NOT EXISTS kit_contest;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
```

## 스토리지(Supabase Storage)

업로드 API(`/api/upload-urls`)는 Supabase signed upload URL을 발급해 브라우저 direct upload를 수행합니다.

필수 환경 변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 클라이언트 노출 금지)
- `SUPABASE_STORAGE_BUCKET` (기본값: `kit-contest-assets`)

권장 설정:

1. 버킷을 `public`으로 만들어 데모 중 파일 URL 접근을 단순화합니다.
2. 프로덕션에서는 버킷을 `private`로 운영하고 읽기 signed URL을 별도 발급합니다.
3. Service Role Key는 서버 런타임 환경 변수에만 저장합니다.

## 폴더

- `app`: 화면 및 라우팅
- `public`: 정적 파일

## 참고

- `pnpm-workspace.yaml`은 현재 워크스페이스 환경에서 생성된 pnpm 설정 파일입니다.
- 실제 모노레포 패키지 관리는 아직 적용하지 않았습니다.
