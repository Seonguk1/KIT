from __future__ import annotations

from datetime import datetime, timezone

from constants import (
	RECORDING_TABLE,
	STT_STATUS_COMPLETED,
	STT_STATUS_FAILED,
	STT_STATUS_POST_PROCESSING,
	STT_STATUS_QUEUED,
	STT_STATUS_TRANSCRIBING,
	STT_STATUS_UPLOADED,
	TRANSCRIPT_SEGMENT_TABLE,
)
from services.db_service import DatabaseService
from services.llm_service import LLMService
from services.storage_service import StorageService
from services.stt_service import STTService
from utils.demo_content import build_recording_segments


def _utc_now() -> str:
	return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def move_to_queue_if_uploaded(database: DatabaseService, recording: dict[str, object]) -> None:
	if recording["sttStatus"] != STT_STATUS_UPLOADED:
		return

	database.execute(
		f'UPDATE "{RECORDING_TABLE}" SET "sttStatus" = ?, "updatedAt" = ? WHERE "id" = ?',
		(STT_STATUS_QUEUED, _utc_now(), str(recording["id"])),
	)


def mark_transcribing(database: DatabaseService, recording_id: str) -> None:
	database.execute(
		f'UPDATE "{RECORDING_TABLE}" SET "sttStatus" = ?, "updatedAt" = ? WHERE "id" = ?',
		(STT_STATUS_TRANSCRIBING, _utc_now(), recording_id),
	)


def ensure_segments(database: DatabaseService, recording: dict[str, object]) -> None:
	recording_id = str(recording["id"])
	existing_segment_count = database.fetch_one(
		f'SELECT COUNT(*) AS count FROM "{TRANSCRIPT_SEGMENT_TABLE}" WHERE "recordingId" = ?',
		(recording_id,),
	)

	if int(existing_segment_count["count"] if existing_segment_count else 0) > 0:
		return

	material = database.fetch_one(
		'SELECT * FROM "Material" WHERE "sessionId" = ? ORDER BY "createdAt" ASC LIMIT 1',
		(recording["sessionId"],),
	)
	if not material:
		return

	sections = database.fetch_all(
		'SELECT * FROM "MaterialSection" WHERE "materialId" = ? ORDER BY "orderIndex" ASC',
		(material["id"],),
	)
	section_by_id = {str(section["id"]): section for section in sections}

	storage_service = StorageService()
	stt_service = STTService()
	llm_service = LLMService()

	segments: list[dict[str, object]] = []
	try:
		file_bytes = storage_service.download_file_bytes(str(recording["fileUrl"]))
		transcript_segments = stt_service.transcribe(
			file_bytes=file_bytes,
			file_name=str(recording.get("name") or f"{recording_id}.mp4"),
			language=str(recording.get("language") or "ko"),
		)

		if transcript_segments:
			total_duration_ms = max(segment.end_ms for segment in transcript_segments)

			def map_section_and_page(start_ms: int, end_ms: int) -> tuple[str | None, int | None]:
				if not sections or total_duration_ms <= 0:
					return None, None

				midpoint = (start_ms + end_ms) // 2
				position = min(max(midpoint / total_duration_ms, 0.0), 0.9999)
				index = int(position * len(sections))
				section = sections[min(index, len(sections) - 1)]
				return str(section["id"]), int(section["startPage"])

			for idx, transcript in enumerate(transcript_segments, start=1):
				section_id, page_number = map_section_and_page(transcript.start_ms, transcript.end_ms)
				section_title = str(section_by_id[section_id]["title"]) if section_id and section_id in section_by_id else None
				refined_text = llm_service.refine_transcript_text(
					raw_text=transcript.raw_text,
					section_title=section_title,
					page_number=page_number,
				)

				segments.append(
					{
						"id": f"{recording_id}-segment-{idx}",
						"startMs": transcript.start_ms,
						"endMs": transcript.end_ms,
						"rawText": transcript.raw_text,
						"refinedText": refined_text,
						"sectionId": section_id,
						"pageNumber": page_number,
						"mappingScore": transcript.confidence,
					},
				)
	except Exception:
		segments = []

	if not segments:
		segments = build_recording_segments(recording_id, sections)

	database.execute_many(
		f'''
		INSERT OR IGNORE INTO "{TRANSCRIPT_SEGMENT_TABLE}"
		("id", "recordingId", "startMs", "endMs", "rawText", "refinedText", "speakerLabel", "sectionId", "pageNumber", "confidenceScore", "createdAt", "updatedAt")
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		''',
		[
			(
				segment["id"],
				recording_id,
				segment["startMs"],
				segment["endMs"],
				segment["rawText"],
				segment["refinedText"],
				None,
				segment["sectionId"],
				segment["pageNumber"],
				segment["mappingScore"],
				_utc_now(),
				_utc_now(),
			)
			for segment in segments
		],
	)


def mark_post_processing(database: DatabaseService, recording_id: str) -> None:
	database.execute(
		f'UPDATE "{RECORDING_TABLE}" SET "sttStatus" = ?, "updatedAt" = ? WHERE "id" = ?',
		(STT_STATUS_POST_PROCESSING, _utc_now(), recording_id),
	)


def finalize_recording_completed(database: DatabaseService, recording: dict[str, object]) -> None:
	recording_id = str(recording["id"])
	subtitle_url = recording["subtitleUrl"] or f"https://storage.demo/files/{recording_id}.vtt"

	database.execute(
		f'''
		UPDATE "{RECORDING_TABLE}"
		SET "sttStatus" = ?,
			"subtitleUrl" = ?,
			"updatedAt" = ?
		WHERE "id" = ?
		''',
		(STT_STATUS_COMPLETED, subtitle_url, _utc_now(), recording_id),
	)


def mark_recording_failed(database: DatabaseService, recording_id: str) -> None:
	database.execute(
		f'UPDATE "{RECORDING_TABLE}" SET "sttStatus" = ?, "updatedAt" = ? WHERE "id" = ?',
		(STT_STATUS_FAILED, _utc_now(), recording_id),
	)
