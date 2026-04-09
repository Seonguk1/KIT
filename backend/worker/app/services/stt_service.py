from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from openai import OpenAI


@dataclass(frozen=True)
class TranscriptSegment:
	start_ms: int
	end_ms: int
	raw_text: str
	confidence: float


class STTService:
	def __init__(self) -> None:
		self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
		self.model = os.getenv("WORKER_STT_MODEL", "gpt-4o-mini-transcribe")
		self.client = OpenAI(api_key=self.api_key) if self.api_key else None

	def transcribe(self, file_bytes: bytes, file_name: str, language: str = "ko") -> list[TranscriptSegment]:
		if not file_bytes or self.client is None:
			return []

		suffix = Path(file_name).suffix or ".mp4"
		with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as temp_file:
			temp_file.write(file_bytes)
			temp_file.flush()

			try:
				with open(temp_file.name, "rb") as audio_file:
					response = self.client.audio.transcriptions.create(
						model=self.model,
						file=audio_file,
						language=language,
						response_format="verbose_json",
						timestamp_granularities=["segment"],
					)
			except Exception:
				return []

		segments = getattr(response, "segments", None) or []
		results: list[TranscriptSegment] = []
		for segment in segments:
			text = str(getattr(segment, "text", "")).strip()
			if not text:
				continue

			start_sec = float(getattr(segment, "start", 0.0) or 0.0)
			end_sec = float(getattr(segment, "end", start_sec) or start_sec)
			if end_sec < start_sec:
				end_sec = start_sec

			results.append(
				TranscriptSegment(
					start_ms=max(0, int(start_sec * 1000)),
					end_ms=max(0, int(end_sec * 1000)),
					raw_text=text,
					confidence=0.9,
				),
			)

		return results
