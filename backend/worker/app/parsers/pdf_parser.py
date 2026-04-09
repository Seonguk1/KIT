from __future__ import annotations

import re

import fitz


def _normalize_text(raw_text: str) -> str:
	return re.sub(r"\s+", " ", raw_text).strip()


def _title_candidate(raw_text: str, fallback_title: str, page_number: int) -> str:
	for line in raw_text.splitlines():
		line_text = line.strip()
		if line_text:
			return line_text[:120]

	return f"{fallback_title} {page_number}페이지"


def _extract_keywords(normalized_text: str) -> list[str]:
	tokens = re.findall(r"[A-Za-z가-힣0-9]{2,}", normalized_text)
	seen: set[str] = set()
	keywords: list[str] = []

	for token in tokens:
		lowered = token.lower()
		if lowered in seen:
			continue
		seen.add(lowered)
		keywords.append(token)
		if len(keywords) >= 5:
			break

	return keywords if keywords else ["학습", "자료"]


def _guess_page_type(normalized_text: str, page_number: int, page_count: int) -> str:
	lowered = normalized_text.lower()

	if "목차" in normalized_text or "table of contents" in lowered:
		return "toc"
	if "실습" in normalized_text:
		return "practice"
	if "정리" in normalized_text:
		return "summary"
	if page_number == 1:
		return "cover"
	if page_number <= max(2, page_count // 4):
		return "overview"
	return "content"


def _extraction_quality(text_length: int) -> str:
	if text_length >= 500:
		return "high"
	if text_length >= 120:
		return "medium"
	if text_length > 0:
		return "low"
	return "empty"


def extract_page_signals_from_pdf(pdf_bytes: bytes, fallback_title: str) -> list[dict[str, object]]:
	if not pdf_bytes:
		raise ValueError("PDF 바이트가 비어 있습니다.")

	page_signals: list[dict[str, object]] = []
	with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
		page_count = document.page_count
		if page_count == 0:
			raise ValueError("PDF 페이지가 0입니다.")

		for index, page in enumerate(document, start=1):
			raw_text = page.get_text("text") or ""
			normalized_text = _normalize_text(raw_text)
			text_length = len(normalized_text)

			page_signals.append(
				{
					"pageNumber": index,
					"titleCandidate": _title_candidate(raw_text, fallback_title, index),
					"pageType": _guess_page_type(normalized_text, index, page_count),
					"keywordCandidates": _extract_keywords(normalized_text),
					"rawText": normalized_text,
					"textLength": text_length,
					"extractionQuality": _extraction_quality(text_length),
				},
			)

	return page_signals
