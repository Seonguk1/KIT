from __future__ import annotations

import logging

from pipelines.quiz_pipeline import (
	ensure_quiz_questions,
	ensure_quiz_row,
	finalize_quiz_job_completed,
	mark_quiz_job_failed,
	move_job_to_processing_if_queued,
	resolve_quiz_context,
)
from services.db_service import DatabaseService


LOGGER = logging.getLogger("kit-contest-worker")


def run_quiz_pipeline(database: DatabaseService, job: dict[str, object]) -> bool:
	job_id = str(job["id"])
	stage_name = "start"
	LOGGER.info("[quiz:%s] pipeline start", job_id)

	try:
		# 1) 상태 전이
		stage_name = "move_job_to_processing_if_queued"
		LOGGER.info("[quiz:%s] stage=%s", job_id, stage_name)
		move_job_to_processing_if_queued(database, job)

		# 2) 생성 컨텍스트 해석
		stage_name = "resolve_quiz_context"
		LOGGER.info("[quiz:%s] stage=%s", job_id, stage_name)
		context = resolve_quiz_context(database, job)

		# 3) 퀴즈/문항 생성
		stage_name = "ensure_quiz_row"
		LOGGER.info("[quiz:%s] stage=%s", job_id, stage_name)
		ensure_quiz_row(database, job, context)
		stage_name = "ensure_quiz_questions"
		LOGGER.info("[quiz:%s] stage=%s", job_id, stage_name)
		ensure_quiz_questions(database, context)

		# 4) 완료 반영
		stage_name = "finalize_quiz_job_completed"
		LOGGER.info("[quiz:%s] stage=%s", job_id, stage_name)
		finalize_quiz_job_completed(database, job_id, str(context["quizId"]))
		LOGGER.info("[quiz:%s] pipeline completed", job_id)
		return True

	except Exception as error:  # pragma: no cover - worker loop safety net
		LOGGER.exception("[quiz:%s] pipeline failed at stage=%s: %s", job_id, stage_name, error)
		mark_quiz_job_failed(database, job_id, error)
		return False
