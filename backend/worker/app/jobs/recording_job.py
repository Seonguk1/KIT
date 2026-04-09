from __future__ import annotations

from constants import (
	RECORDING_TABLE,
	STT_STATUS_QUEUED,
	STT_STATUS_UPLOADED,
)
from pipelines.stt_orchestrator import run_stt_pipeline
from services.db_service import DatabaseService


def process_recordings(database: DatabaseService, limit: int) -> int:
	recordings = database.fetch_all(
		f'''
		SELECT *
		FROM "{RECORDING_TABLE}"
		WHERE COALESCE("sttEnabled", true) = true
		  AND "sttStatus" IN (?, ?)
		ORDER BY "createdAt" ASC
		LIMIT ?
		''',
		(STT_STATUS_UPLOADED, STT_STATUS_QUEUED, limit),
	)

	processed_count = 0
	for recording in recordings:
		if run_stt_pipeline(database, recording):
			processed_count += 1

	return processed_count
