'use client';

import { useEffect, useState } from 'react';

interface MaterialPage {
  pageNumber: number;
  sectionId?: string;
  topicSentence: string;
  summary: string;
  keywords: string[];
}

interface MaterialSection {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
}

interface PdfViewerProps {
  materialId: string;
}

export function PdfViewer({ materialId }: PdfViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pages, setPages] = useState<MaterialPage[]>([]);
  const [sections, setSections] = useState<MaterialSection[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 페이지 데이터 로드
  useEffect(() => {
    const loadPdfData = async () => {
      try {
        setIsLoading(true);
        const [pagesRes, sectionsRes] = await Promise.all([
          fetch(`/api/materials/${materialId}/pages`),
          fetch(`/api/materials/${materialId}/sections`),
        ]);

        if (!pagesRes.ok || !sectionsRes.ok) {
          throw new Error('PDF 데이터 로드 실패');
        }

        const pagesData = await pagesRes.json();
        const sectionsData = await sectionsRes.json();

        setPages(Array.isArray(pagesData) ? pagesData : []);
        setSections(Array.isArray(sectionsData) ? sectionsData : []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류 발생');
        console.error('PDF 데이터 로드 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (materialId) {
      loadPdfData();
    }
  }, [materialId]);

  const totalPages = pages.length || 1;
  const currentPageData = pages[currentPage - 1];

  const handlePageChange = (newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(validPage);
  };

  const handleGoToSection = (startPage: number) => {
    handlePageChange(startPage);
    setShowToc(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 툴바 */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
        >
          ← 이전
        </button>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
            className="w-12 rounded border border-gray-300 px-2 py-1 text-sm text-center"
          />
          <span className="text-sm text-gray-600">/ {totalPages}</span>
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded px-3 py-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
        >
          다음 →
        </button>

        {sections.length > 0 && (
          <button
            onClick={() => setShowToc(!showToc)}
            className="ml-auto rounded px-3 py-1 bg-blue-100 hover:bg-blue-200 text-sm font-medium text-blue-700"
          >
            {showToc ? '목차 닫기' : '목차 열기'}
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 목차 패널 */}
        {showToc && sections.length > 0 && (
          <div className="w-56 border-r border-gray-200 overflow-y-auto bg-gray-50 p-4">
            <h3 className="text-sm font-bold mb-3 text-gray-900">목차</h3>
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleGoToSection(section.startPage)}
                  className="block w-full text-left px-3 py-2 rounded hover:bg-blue-100 text-sm text-gray-700 hover:text-blue-700 transition"
                >
                  <div className="font-medium truncate">{section.title}</div>
                  <div className="text-xs text-gray-500">
                    p. {section.startPage}-{section.endPage}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 페이지 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentPageData ? (
            <div className="max-w-3xl mx-auto">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentPageData.topicSentence}
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  {currentPageData.summary}
                </p>
              </div>

              {currentPageData.keywords.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    주요 키워드
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {currentPageData.keywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 rounded border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="text-gray-500">📄 PDF 렌더링</p>
                <p className="text-xs text-gray-400 mt-2">
                  프로덕션에서 실제 PDF 렌더링이 표시됩니다
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500">페이지를 불러올 수 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
