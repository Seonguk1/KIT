from __future__ import annotations

from constants import (
	MATERIAL_STATUS_QUEUED,
	MATERIAL_STATUS_UPLOADED,
)
from pipelines.pdf_orchestrator import run_pdf_pipeline
from services.db_service import DatabaseService


def process_materials(database: DatabaseService, limit: int) -> int:
	materials = database.fetch_all(
		f'''
		SELECT *
		FROM "Material"
		WHERE "extractEnabled" = true
		  AND "processingStatus" IN (?, ?)
		ORDER BY "createdAt" ASC
		LIMIT ?
		''',
		(MATERIAL_STATUS_UPLOADED, MATERIAL_STATUS_QUEUED, limit),
	)

	processed_count = 0
	for material in materials:
		if run_pdf_pipeline(database, material):
			processed_count += 1

	return processed_count
