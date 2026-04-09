"use client";

import { useEffect, useState } from "react";

type MaterialPage = {
  pageNumber: number;
  sectionId: string | null;
  topicSentence: string;
  summary: string;
  keywords: string[];
};

type MaterialSection = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
};

type PdfViewerProps = {
  materialId: string;
  materialName: string;
  targetPage?: number | null;
  onPageSynced?: () => void;
};

export function PdfViewer({ materialId, materialName, targetPage, onPageSynced }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<MaterialPage[]>([]);
  const [sections, setSections] = useState<MaterialSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    async function loadPages() {
      setIsLoading(true);
      setError(null);

      try {
        // 페이지 데이터 로드
        const pagesResponse = await fetch(`/api/materials/${materialId}/pages`, {
          cache: "no-store",
        });

        if (!pagesResponse.ok) {
          throw new Error("페이지 정보를 불러올 수 없습니다.");
        }

        const pagesData = (await pagesResponse.json()) as { pages: MaterialPage[] };
        setPages(pagesData.pages);
        setTotalPages(pagesData.pages.length);

        // 섹션(목차) 데이터 로드
        const sectionsResponse = await fetch(`/api/materials/${materialId}/sections`, {
          cache: "no-store",
        });

        if (sectionsResponse.ok) {
          const sectionsData = (await sectionsResponse.json()) as { sections: MaterialSection[] };
          setSections(sectionsData.sections);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPages();
  }, [materialId]);

  useEffect(() => {
    if (!targetPage) {
      return;
    }

    handlePageChange(targetPage);
    onPageSynced?.();
  }, [targetPage, onPageSynced, totalPages]);

  const currentPageData = pages.find((p) => p.pageNumber === currentPage);

  function handlePageChange(page: number) {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }

  function handleGoToSection(startPage: number) {
    handlePageChange(startPage);
    setShowToc(false);
  }

  if (isLoading) {
    return (
      <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
        <div className="h-96 animate-pulse rounded-lg border border-dashed border-zinc-300 bg-zinc-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">PDF 자료</p>
          <h3 className="mt-1 font-semibold text-zinc-950">{materialName}</h3>
        </div>
        {sections.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowToc(!showToc)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            {showToc ? "목차 닫기" : "목차 보기"}
          </button>
        ) : null}
      </div>

      {/* 목차 팝오버 */}
      {showToc && sections.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-900">목차</p>
          <div className="mt-3 space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => handleGoToSection(section.startPage)}
                className="block w-full text-left rounded-lg px-3 py-2 text-sm transition hover:bg-amber-100"
              >
                <p className="font-medium text-amber-900">{section.title}</p>
                <p className="text-xs text-amber-700">
                  {section.startPage}〜{section.endPage}쪽
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 뷰어 영역 */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-8">
        {currentPageData ? (
          <div className="space-y-4">
            {/* 페이지 미리보기 */}
            <div className="rounded-lg border border-zinc-300 bg-white p-6">
              <div className="text-center text-sm text-zinc-600">
                <p className="text-xs uppercase tracking-wider text-zinc-500">PDF 페이지 {currentPage}</p>
                <div className="mt-4 h-72 rounded border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center">
                  <div className="text-center">
                    <p className="font-semibold text-zinc-700">📄 PDF 렌더링</p>
                    <p className="mt-1 text-xs text-zinc-600">프로덕션에서 구현</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 페이지 정보 */}
            <div className="space-y-2 rounded-lg bg-white p-4">
              <div>
                <p className="text-xs font-semibold text-zinc-600">주제문</p>
                <p className="mt-1 text-sm text-zinc-900">{currentPageData.topicSentence}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-600">요약</p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{currentPageData.summary}</p>
              </div>
              {currentPageData.keywords.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-zinc-600">키워드</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentPageData.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* 네비게이션 */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => handlePageChange(currentPage - 1)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← 이전 페이지
        </button>

        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => handlePageChange(Number(e.currentTarget.value))}
            className="w-16 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-sm font-semibold text-zinc-900 outline-none ring-amber-300 transition focus:ring-2"
          />
          <span className="text-sm font-semibold text-zinc-600">/ {totalPages}</span>
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음 페이지 →
        </button>
      </div>

      {/* 상태 표시 */}
      <div className="mt-3 text-center text-xs text-zinc-600">
        {totalPages === 0 ? "페이지 정보가 없습니다." : `총 ${totalPages}페이지 중 ${currentPage}페이지 보는 중`}
      </div>
    </div>
  );
}
