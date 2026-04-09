from __future__ import annotations

import logging

from pipelines.stt_pipeline import (
	ensure_segments,
	finalize_recording_completed,
	mark_post_processing,
	mark_recording_failed,
	mark_transcribing,
	move_to_queue_if_uploaded,
)
from services.db_service import DatabaseService


LOGGER = logging.getLogger("kit-contest-worker")


def run_stt_pipeline(database: DatabaseService, recording: dict[str, object]) -> bool:
	recording_id = str(recording["id"])
	stage_name = "start"
	LOGGER.info("[stt:%s] pipeline start", recording_id)

	try:
		# 1) 상태 전이
		stage_name = "move_to_queue_if_uploaded"
		LOGGER.info("[stt:%s] stage=%s", recording_id, stage_name)
		move_to_queue_if_uploaded(database, recording)
		stage_name = "mark_transcribing"
		LOGGER.info("[stt:%s] stage=%s", recording_id, stage_name)
		mark_transcribing(database, recording_id)

		# 2) 세그먼트 생성/매핑
		stage_name = "ensure_segments"
		LOGGER.info("[stt:%s] stage=%s", recording_id, stage_name)
		ensure_segments(database, recording)

		# 3) 후처리
		stage_name = "mark_post_processing"
		LOGGER.info("[stt:%s] stage=%s", recording_id, stage_name)
		mark_post_processing(database, recording_id)

		# 4) 완료 반영
		stage_name = "finalize_recording_completed"
		LOGGER.info("[stt:%s] stage=%s", recording_id, stage_name)
		finalize_recording_completed(database, recording)
		LOGGER.info("[stt:%s] pipeline completed", recording_id)
		return True

	except Exception:  # pragma: no cover - worker loop safety net
		LOGGER.exception("[stt:%s] pipeline failed at stage=%s", recording_id, stage_name)
		mark_recording_failed(database, recording_id)
		return False
