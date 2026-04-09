from __future__ import annotations

from datetime import datetime, timezone

from constants import (
	JOB_STATUS_COMPLETED,
	JOB_STATUS_FAILED,
	JOB_STATUS_PROCESSING,
	JOB_STATUS_QUEUED,
	QUIZ_QUESTION_TABLE,
	QUIZ_STATUS_DRAFT,
	QUIZ_TABLE,
)
from services.db_service import DatabaseService
from utils.demo_content import build_quiz_questions


def _utc_now() -> str:
	return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def move_job_to_processing_if_queued(database: DatabaseService, job: dict[str, object]) -> None:
	if job["status"] != JOB_STATUS_QUEUED:
		return

	database.execute(
		'UPDATE "QuizGenerationJob" SET "status" = ?, "updatedAt" = ? WHERE "id" = ?',
		(JOB_STATUS_PROCESSING, _utc_now(), str(job["id"])),
	)


def resolve_quiz_context(database: DatabaseService, job: dict[str, object]) -> dict[str, object]:
	quiz_id = str(job["quizId"]) if job["quizId"] else f"quiz-{job['id']}"
	session = database.fetch_one('SELECT * FROM "Session" WHERE "id" = ?', (job["sessionId"],))
	material = database.fetch_one(
		'SELECT * FROM "Material" WHERE "sessionId" = ? ORDER BY "createdAt" ASC LIMIT 1',
		(job["sessionId"],),
	)
	if not session or not material:
		raise RuntimeError("세션 또는 자료를 찾을 수 없습니다.")

	sections = database.fetch_all(
		'SELECT * FROM "MaterialSection" WHERE "materialId" = ? ORDER BY "orderIndex" ASC',
		(material["id"],),
	)
	section_id = job["sectionId"] or (sections[1]["id"] if len(sections) > 1 else sections[0]["id"] if sections else None)

	return {
		"quizId": quiz_id,
		"session": session,
		"material": material,
		"sectionId": section_id,
		"count": int(job["count"] or 5),
	}


def ensure_quiz_row(database: DatabaseService, job: dict[str, object], context: dict[str, object]) -> None:
	database.execute(
		f'''
		INSERT OR IGNORE INTO "{QUIZ_TABLE}"
		("id", "sessionId", "materialId", "sectionId", "title", "generatedBy", "status", "createdAt", "updatedAt")
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		''',
		(
			context["quizId"],
			job["sessionId"],
			context["material"]["id"],
			context["sectionId"],
			f"{context['session']['title']} 퀴즈",
			"ai",
			QUIZ_STATUS_DRAFT,
			_utc_now(),
			_utc_now(),
		),
	)


def ensure_quiz_questions(database: DatabaseService, context: dict[str, object]) -> None:
	questions = build_quiz_questions(
		str(context["quizId"]),
		context["sectionId"],
		int(context["count"]),
		str(context["material"]["id"]),
	)

	database.execute_many(
		f'''
		INSERT OR IGNORE INTO "{QUIZ_QUESTION_TABLE}"
		("id", "quizId", "type", "questionText", "choices", "answer", "explanation", "sourceMaterialId", "sourcePageNumber", "sourceSectionId", "createdAt", "updatedAt")
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		''',
		[
			(
				question["id"],
				question["quizId"],
				question["type"],
				question["questionText"],
				question["choices"],
				question["answer"],
				question["explanation"],
				question["sourceMaterialId"],
				question["sourcePageNumber"],
				question["sourceSectionId"],
				_utc_now(),
				_utc_now(),
			)
			for question in questions
		],
	)


def finalize_quiz_job_completed(database: DatabaseService, job_id: str, quiz_id: str) -> None:
	database.execute(
		'''
		UPDATE "QuizGenerationJob"
		SET "status" = ?, "quizId" = ?, "updatedAt" = ?
		WHERE "id" = ?
		''',
		(JOB_STATUS_COMPLETED, quiz_id, _utc_now(), job_id),
	)


def mark_quiz_job_failed(database: DatabaseService, job_id: str, error: Exception) -> None:
	database.execute(
		'''
		UPDATE "QuizGenerationJob"
		SET "status" = ?, "error" = ?, "updatedAt" = ?
		WHERE "id" = ?
		''',
		(JOB_STATUS_FAILED, str(error), _utc_now(), job_id),
	)
