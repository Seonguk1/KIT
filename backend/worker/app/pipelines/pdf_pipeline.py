from __future__ import annotations

from datetime import datetime, timezone

from constants import (
	MATERIAL_PAGE_TABLE,
	MATERIAL_SECTION_TABLE,
	MATERIAL_STATUS_COMPLETED,
	MATERIAL_STATUS_FAILED,
	MATERIAL_STATUS_PROCESSING,
	MATERIAL_STATUS_QUEUED,
	MATERIAL_STATUS_UPLOADED,
)
from parsers.pdf_parser import extract_page_signals_from_pdf
from services.db_service import DatabaseService
from services.storage_service import StorageService
from utils.demo_content import build_material_structure


def _utc_now() -> str:
	return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def move_to_queue_if_uploaded(database: DatabaseService, material: dict[str, object]) -> None:
	if material["processingStatus"] != MATERIAL_STATUS_UPLOADED:
		return

	database.execute(
		'UPDATE "Material" SET "processingStatus" = ?, "updatedAt" = ? WHERE "id" = ?',
		(MATERIAL_STATUS_QUEUED, _utc_now(), str(material["id"])),
	)


def mark_processing(database: DatabaseService, material_id: str) -> None:
	database.execute(
		'UPDATE "Material" SET "processingStatus" = ?, "updatedAt" = ? WHERE "id" = ?',
		(MATERIAL_STATUS_PROCESSING, _utc_now(), material_id),
	)


def build_source_descriptor(material: dict[str, object]) -> dict[str, object]:
	return {
		"materialId": str(material["id"]),
		"fileUrl": str(material["fileUrl"]),
		"mimeType": str(material["mimeType"]),
		"title": str(material["name"]).removesuffix(".pdf"),
		"pageCount": int(material["pageCount"] or 12),
	}


def extract_page_signals(source: dict[str, object]) -> list[dict[str, object]]:
	storage_service = StorageService()
	pdf_bytes = storage_service.download_file_bytes(str(source["fileUrl"]))
	page_signals = extract_page_signals_from_pdf(pdf_bytes, str(source["title"]))

	# 실제 PDF 페이지 수를 후속 단계에 반영한다.
	source["pageCount"] = len(page_signals)
	return page_signals


def summarize_global_context(
	source: dict[str, object],
	page_signals: list[dict[str, object]],
) -> dict[str, object]:
	title = str(source["title"])
	return {
		"documentTopic": f"{title} 학습 구조",
		"flow": ["강의 개요", "핵심 개념", "실습 및 정리"],
		"signalCount": len(page_signals),
	}


def build_section_candidates(
	source: dict[str, object],
	global_context: dict[str, object],
	page_signals: list[dict[str, object]],
) -> list[dict[str, object]]:
	_ = global_context
	_ = page_signals
	structure = build_material_structure(
		str(source["materialId"]),
		int(source["pageCount"]),
		str(source["title"]),
	)
	return structure["sections"]


def build_page_records(
	source: dict[str, object],
	sections: list[dict[str, object]],
	global_context: dict[str, object],
	page_signals: list[dict[str, object]],
) -> list[dict[str, object]]:
	def resolve_section_id(page_number: int) -> str | None:
		for section in sections:
			start_page = int(section["startPage"])
			end_page = int(section["endPage"])
			if start_page <= page_number <= end_page:
				return str(section["id"])
		return None

	material_id = str(source["materialId"])
	pages: list[dict[str, object]] = []
	for signal in page_signals:
		page_number = int(signal["pageNumber"])
		raw_text = str(signal.get("rawText") or "")
		summary_seed = raw_text[:220] if raw_text else f"{source['title']} {page_number}페이지 텍스트 추출 결과가 짧습니다."

		pages.append(
			{
				"id": f"{material_id}-page-{page_number}",
				"pageNumber": page_number,
				"sectionId": resolve_section_id(page_number),
				"topicSentence": str(signal["titleCandidate"]),
				"summary": f"{summary_seed} 문서 전역 주제: {global_context['documentTopic']}",
				"keywords": signal.get("keywordCandidates") or ["학습", f"P{page_number}"],
			},
		)

	return pages


def persist_sections_and_pages(
	database: DatabaseService,
	material_id: str,
	sections: list[dict[str, object]],
	pages: list[dict[str, object]],
) -> None:
	existing_section_count = database.fetch_one(
		f'SELECT COUNT(*) AS count FROM "{MATERIAL_SECTION_TABLE}" WHERE "materialId" = ?',
		(material_id,),
	)
	existing_page_count = database.fetch_one(
		f'SELECT COUNT(*) AS count FROM "{MATERIAL_PAGE_TABLE}" WHERE "materialId" = ?',
		(material_id,),
	)

	if int(existing_section_count["count"] if existing_section_count else 0) == 0:
		database.execute_many(
			f'''
			INSERT OR IGNORE INTO "{MATERIAL_SECTION_TABLE}"
			("id", "materialId", "parentSectionId", "title", "level", "startPage", "endPage", "orderIndex", "createdAt", "updatedAt")
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			''',
			[
				(
					section["id"],
					material_id,
					None,
					section["title"],
					1,
					section["startPage"],
					section["endPage"],
					section["startPage"],
					_utc_now(),
					_utc_now(),
				)
				for section in sections
			],
		)

	if int(existing_page_count["count"] if existing_page_count else 0) == 0:
		database.execute_many(
			f'''
			INSERT OR IGNORE INTO "{MATERIAL_PAGE_TABLE}"
			("id", "materialId", "pageNumber", "sectionId", "topicSentence", "summary", "keywords", "embeddingStatus", "createdAt", "updatedAt")
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			''',
			[
				(
					page["id"],
					material_id,
					page["pageNumber"],
					page["sectionId"],
					page["topicSentence"],
					page["summary"],
					page["keywords"],
					"completed",
					_utc_now(),
					_utc_now(),
				)
				for page in pages
			],
		)


def finalize_material_completed(
	database: DatabaseService,
	material_id: str,
	source: dict[str, object],
	global_context: dict[str, object],
) -> None:
	title = str(source["title"])
	page_count = int(source["pageCount"])

	database.execute(
		'''
		UPDATE "Material"
		SET "processingStatus" = ?,
			"analysisSummary" = ?,
			"tocStatus" = ?,
			"pageCountAnalyzed" = ?,
			"lastProcessedAt" = ?,
			"updatedAt" = ?
		WHERE "id" = ?
		''',
		(
			MATERIAL_STATUS_COMPLETED,
			f"{title} 문서를 구조화하여 목차/페이지 분석을 완료했습니다. 전역 주제: {global_context['documentTopic']}",
			"completed",
			page_count,
			_utc_now(),
			_utc_now(),
			material_id,
		),
	)


def mark_material_failed(database: DatabaseService, material_id: str, error: Exception) -> None:
	database.execute(
		'''
		UPDATE "Material"
		SET "processingStatus" = ?,
			"analysisSummary" = ?,
			"tocStatus" = ?,
			"updatedAt" = ?
		WHERE "id" = ?
		''',
		(
			MATERIAL_STATUS_FAILED,
			f"워커 처리 실패: {error}",
			"failed",
			_utc_now(),
			material_id,
		),
	)
