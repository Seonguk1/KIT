from __future__ import annotations

import os

from openai import OpenAI


class LLMService:
	def __init__(self) -> None:
		self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
		self.model = os.getenv("WORKER_LLM_MODEL", "gpt-4o-mini")
		self.client = OpenAI(api_key=self.api_key) if self.api_key else None

	def refine_transcript_text(
		self,
		raw_text: str,
		section_title: str | None = None,
		page_number: int | None = None,
	) -> str:
		if not raw_text.strip():
			return raw_text

		if self.client is None:
			return raw_text

		context_parts: list[str] = []
		if section_title:
			context_parts.append(f"section={section_title}")
		if page_number is not None:
			context_parts.append(f"page={page_number}")
		context_text = ", ".join(context_parts) if context_parts else "없음"

		prompt = (
			"다음 강의 자막 문장을 원문의 의미를 유지한 채 한국어 문장부호/띄어쓰기만 최소 보정해 주세요. "
			"새로운 정보는 추가하지 마세요.\n"
			f"맥락: {context_text}\n"
			f"원문: {raw_text}"
		)

		try:
			response = self.client.responses.create(
				model=self.model,
				input=[
					{
						"role": "system",
						"content": "당신은 교육용 자막 교정기입니다. 의미 보존을 최우선으로 합니다.",
					},
					{"role": "user", "content": prompt},
				],
			)
			refined = (response.output_text or "").strip()
			return refined if refined else raw_text
		except Exception:
			return raw_text
