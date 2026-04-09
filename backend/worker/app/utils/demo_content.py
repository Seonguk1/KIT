from __future__ import annotations


seed_ids = {
    "courseId": "course-ai-intro-01",
    "sessionId": "session-ai-intro-01",
    "materialId": "material-ai-intro-01",
    "recordingId": "recording-ai-intro-01",
    "quizId": "quiz-ai-intro-01",
    "quizJobId": "job-ai-intro-01",
}


def build_material_structure(material_id: str, page_count: int, title: str) -> dict[str, list[dict[str, object]]]:
	section_specs = [
		{"title": "강의 개요", "startPage": 1, "endPage": max(1, min(3, page_count))},
		{"title": "핵심 개념", "startPage": 4, "endPage": max(4, min(7, page_count))},
		{"title": "실습 및 정리", "startPage": 8, "endPage": max(8, page_count)},
	]

	sections: list[dict[str, object]] = []
	for index, section_spec in enumerate(section_specs, start=1):
		if section_spec["startPage"] > section_spec["endPage"]:
			continue

		sections.append(
			{
				"id": f"{material_id}-section-{index}",
				"title": section_spec["title"],
				"startPage": section_spec["startPage"],
				"endPage": section_spec["endPage"],
			},
		)

	pages: list[dict[str, object]] = []
	for page_number in range(1, page_count + 1):
		section = next(
			(
				item
				for item in sections
				if int(item["startPage"]) <= page_number <= int(item["endPage"])
			),
			None,
		)

		pages.append(
			{
				"id": f"{material_id}-page-{page_number}",
				"pageNumber": page_number,
				"sectionId": section["id"] if section else None,
				"topicSentence": f"{title} {page_number}페이지 핵심 요약",
				"summary": f"{title}의 {page_number}페이지에는 데모용 학습 구조와 AI 해설이 정리되어 있습니다.",
				"keywords": ["AI", "학습", "데모", f"P{page_number}"],
			},
		)

	return {"sections": sections, "pages": pages}


def build_recording_segments(recording_id: str, sections: list[dict[str, object]]) -> list[dict[str, object]]:
	return [
		{
			"id": f"{recording_id}-segment-1",
			"startMs": 0,
			"endMs": 31000,
			"rawText": "오늘은 강의자료 구조를 먼저 보고 핵심 목차를 정리합니다.",
			"refinedText": "오늘은 강의자료 구조를 먼저 보고 핵심 목차를 정리합니다.",
			"sectionId": sections[0]["id"] if len(sections) > 0 else None,
			"pageNumber": 1,
			"mappingScore": 0.95,
		},
		{
			"id": f"{recording_id}-segment-2",
			"startMs": 31000,
			"endMs": 62000,
			"rawText": "그다음 녹화본 자막을 목차와 연결해 탐색 단위를 만듭니다.",
			"refinedText": "그다음 녹화본 자막을 목차와 연결해 탐색 단위를 만듭니다.",
			"sectionId": sections[1]["id"] if len(sections) > 1 else None,
			"pageNumber": 4,
			"mappingScore": 0.92,
		},
		{
			"id": f"{recording_id}-segment-3",
			"startMs": 62000,
			"endMs": 98000,
			"rawText": "마지막으로 출처가 있는 QA와 퀴즈로 복습 흐름을 완성합니다.",
			"refinedText": "마지막으로 출처가 있는 QA와 퀴즈로 복습 흐름을 완성합니다.",
			"sectionId": sections[2]["id"] if len(sections) > 2 else None,
			"pageNumber": 8,
			"mappingScore": 0.94,
		},
	]


def build_quiz_questions(
	quiz_id: str,
	section_id: str | None,
	count: int,
	material_id: str,
) -> list[dict[str, object]]:
	templates = [
		{
			"questionText": "강의자료 업로드 후 먼저 생성되는 구조 정보는 무엇인가요?",
			"choices": ["목차와 페이지 분석", "결제 정보", "알림 설정", "과제 점수"],
			"answer": "목차와 페이지 분석",
			"explanation": "이 서비스는 PDF를 먼저 구조화해 학습 탐색 기반을 만듭니다.",
			"pageNumber": 1,
		},
		{
			"questionText": "녹화본 자막을 보정할 때 우선 활용하는 것은 무엇인가요?",
			"choices": ["외부 SNS", "강의자료의 목차와 전문용어", "임의 생성 문장", "결제 로그"],
			"answer": "강의자료의 목차와 전문용어",
			"explanation": "강의자료를 이용하면 자막 정확도와 탐색 연결성이 높아집니다.",
			"pageNumber": 4,
		},
		{
			"questionText": "QA 답변이 가져야 하는 기본 조건은 무엇인가요?",
			"choices": ["근거 없는 빠른 답변", "자료 기반 출처 제공", "무조건 장문 응답", "랜덤 추천"],
			"answer": "자료 기반 출처 제공",
			"explanation": "교육용 QA는 출처가 연결되어야 신뢰성을 확보할 수 있습니다.",
			"pageNumber": 8,
		},
	]

	questions: list[dict[str, object]] = []
	for index in range(count):
		template = templates[index % len(templates)]
		questions.append(
			{
				"id": f"{quiz_id}-question-{index + 1}",
				"questionText": f"{index + 1}. {template['questionText']}",
				"choices": template["choices"],
				"answer": template["answer"],
				"explanation": template["explanation"],
				"sourcePageNumber": template["pageNumber"],
				"sourceSectionId": section_id,
				"sourceMaterialId": material_id,
			},
		)

	return questions