from __future__ import annotations

import argparse
import logging
import time

from config import WorkerSettings, load_settings
from constants import DEFAULT_WORKER_TIMEOUT_SECONDS
from jobs.material_job import process_materials
from jobs.quiz_job import process_quiz_jobs
from jobs.recording_job import process_recordings
from services.db_service import DatabaseService


LOGGER = logging.getLogger("kit-contest-worker")


def _configure_logging() -> None:
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s | %(levelname)s | %(message)s",
	)


def _run_cycle(database: DatabaseService, settings: WorkerSettings) -> dict[str, int]:
	material_count = process_materials(database, settings.batch_size)
	recording_count = process_recordings(database, settings.batch_size)
	quiz_job_count = process_quiz_jobs(database, settings.batch_size)

	return {
		"materials": material_count,
		"recordings": recording_count,
		"quiz_jobs": quiz_job_count,
	}


def run_worker(settings: WorkerSettings) -> None:
	database = DatabaseService(settings.database_url)

	LOGGER.info("Worker started. db=%s poll_interval=%ss once=%s", settings.database_url, settings.poll_interval_seconds, settings.once)

	while True:
		try:
			result = _run_cycle(database, settings)
			LOGGER.info(
				"Cycle complete | materials=%s recordings=%s quiz_jobs=%s",
				result["materials"],
				result["recordings"],
				result["quiz_jobs"],
			)
		except Exception as error:  # pragma: no cover - worker safety net
			LOGGER.exception("Worker cycle failed: %s", error)

		if settings.once:
			break

		time.sleep(settings.poll_interval_seconds)


def main() -> None:
	_configure_logging()

	parser = argparse.ArgumentParser(description="KIT-contest worker")
	parser.add_argument("--once", action="store_true", help="Run a single processing cycle and exit")
	args = parser.parse_args()

	settings = load_settings(once=args.once)
	run_worker(settings)


if __name__ == "__main__":
	main()
