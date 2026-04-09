from __future__ import annotations

import logging

from pipelines.pdf_pipeline import (
	build_page_records,
	build_section_candidates,
	build_source_descriptor,
	extract_page_signals,
	finalize_material_completed,
	mark_material_failed,
	mark_processing,
	move_to_queue_if_uploaded,
	persist_sections_and_pages,
	summarize_global_context,
)
from services.db_service import DatabaseService


LOGGER = logging.getLogger("kit-contest-worker")


def run_pdf_pipeline(database: DatabaseService, material: dict[str, object]) -> bool:
	material_id = str(material["id"])
	stage_name = "start"
	LOGGER.info("[pdf:%s] pipeline start", material_id)

	try:
		# 1) 상태 전이
		stage_name = "move_to_queue_if_uploaded"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		move_to_queue_if_uploaded(database, material)
		stage_name = "mark_processing"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		mark_processing(database, material_id)

		# 2) 입력 소스 정규화
		stage_name = "build_source_descriptor"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		source = build_source_descriptor(material)

		# 3) 페이지 구조 신호 추출
		stage_name = "extract_page_signals"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		page_signals = extract_page_signals(source)

		# 4) 전역 맥락 요약
		stage_name = "summarize_global_context"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		global_context = summarize_global_context(source, page_signals)

		# 5) 목차 후보/확정
		stage_name = "build_section_candidates"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		sections = build_section_candidates(source, global_context, page_signals)

		# 6) 페이지-목차 매핑 + 페이지 요약 생성
		stage_name = "build_page_records"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		pages = build_page_records(source, sections, global_context, page_signals)

		# 7) 결과 저장
		stage_name = "persist_sections_and_pages"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		persist_sections_and_pages(database, material_id, sections, pages)

		# 8) 완료 상태 반영
		stage_name = "finalize_material_completed"
		LOGGER.info("[pdf:%s] stage=%s", material_id, stage_name)
		finalize_material_completed(database, material_id, source, global_context)
		LOGGER.info("[pdf:%s] pipeline completed", material_id)
		return True

	except Exception as error:  # pragma: no cover - worker loop safety net
		LOGGER.exception("[pdf:%s] pipeline failed at stage=%s: %s", material_id, stage_name, error)
		mark_material_failed(database, material_id, error)
		return False
