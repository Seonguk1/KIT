from __future__ import annotations

from constants import (
	JOB_STATUS_PROCESSING,
	JOB_STATUS_QUEUED,
)
from pipelines.quiz_orchestrator import run_quiz_pipeline
from services.db_service import DatabaseService


def process_quiz_jobs(database: DatabaseService, limit: int) -> int:
	jobs = database.fetch_all(
		f'''
		SELECT *
		FROM "QuizGenerationJob"
		WHERE "status" IN (?, ?)
		ORDER BY "createdAt" ASC
		LIMIT ?
		''',
		(JOB_STATUS_QUEUED, JOB_STATUS_PROCESSING, limit),
	)

	processed_count = 0
	for job in jobs:
		if run_quiz_pipeline(database, job):
			processed_count += 1

	return processed_count
