from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv

from constants import (
	DEFAULT_BACKOFF_BASE_SECONDS,
	DEFAULT_BATCH_SIZE,
	DEFAULT_MAX_RETRIES,
	DEFAULT_POLL_INTERVAL_SECONDS,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
WORKER_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = REPO_ROOT / "frontend"


@dataclass(frozen=True)
class WorkerSettings:
	database_url: str
	poll_interval_seconds: int = DEFAULT_POLL_INTERVAL_SECONDS
	batch_size: int = DEFAULT_BATCH_SIZE
	max_retries: int = DEFAULT_MAX_RETRIES
	backoff_base_seconds: int = DEFAULT_BACKOFF_BASE_SECONDS
	once: bool = False


def _read_int(name: str, default: int) -> int:
	raw_value = os.getenv(name)
	if raw_value is None:
		return default

	try:
		return int(raw_value)
	except ValueError:
		return default


def _read_bool(name: str, default: bool = False) -> bool:
	raw_value = os.getenv(name)
	if raw_value is None:
		return default

	return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings(once: bool = False) -> WorkerSettings:
	load_dotenv(REPO_ROOT / ".env")
	load_dotenv(FRONTEND_ROOT / ".env")
	load_dotenv(FRONTEND_ROOT / ".env.local")
	load_dotenv(WORKER_ROOT / ".env")

	database_url = os.getenv("WORKER_DATABASE_URL") or os.getenv("DATABASE_URL")
	if not database_url:
		raise ValueError("WORKER_DATABASE_URL 또는 DATABASE_URL 환경 변수가 필요합니다.")

	return WorkerSettings(
		database_url=database_url,
		poll_interval_seconds=_read_int("WORKER_POLL_INTERVAL_SECONDS", DEFAULT_POLL_INTERVAL_SECONDS),
		batch_size=_read_int("WORKER_BATCH_SIZE", DEFAULT_BATCH_SIZE),
		max_retries=_read_int("WORKER_MAX_RETRIES", DEFAULT_MAX_RETRIES),
		backoff_base_seconds=_read_int("WORKER_BACKOFF_BASE_SECONDS", DEFAULT_BACKOFF_BASE_SECONDS),
		once=once or _read_bool("WORKER_ONCE", False),
	)
