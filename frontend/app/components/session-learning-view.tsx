'use client';

import { useEffect, useState } from 'react';
import { PdfViewer } from './pdf-viewer';
import { VideoPlayer } from './video-player';

interface SessionLearningViewProps {
  sessionId: string;
  courseId: string;
  sessionTitle: string;
  visibility: string;
}

interface Material {
  id: string;
  courseId: string;
  sourceType: 'pdf' | 'video' | 'link';
  fileName: string;
  title: string;
  processingStatus: 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed';
  extract_enabled: boolean;
  created_at: string;
  file_url?: string;
  s3_url?: string;
}

interface Recording {
  id: string;
  courseId: string;
  sessionId: string;
  title: string;
  recordingUrl: string;
  sttStatus: 'queued' | 'processing' | 'completed' | 'failed';
  subtitles?: string[];
}

export function SessionLearningView({
  sessionId,
  courseId,
  sessionTitle,
  visibility,
}: SessionLearningViewProps) {
  const [activeTab, setActiveTab] = useState<'material' | 'recording'>('material');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 세션 데이터 로드
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error('세션 데이터 로드 실패');
        const data = await response.json();
        setMaterials(data.materials || []);
        setRecordings(data.recordings || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류 발생');
        console.error('세션 데이터 로드 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  // 자료 콘텐츠 렌더
  const renderMaterialContent = () => {
    if (!selectedMaterialId) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium">좌측에서 자료를 선택해주세요</p>
          </div>
        </div>
      );
    }

    const material = materials.find((m) => m.id === selectedMaterialId);
    if (!material) return null;

    return <PdfViewer materialId={selectedMaterialId} />;
  };

  // 녹화본 콘텐츠 렌더
  const renderRecordingContent = () => {
    if (!selectedRecordingId) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium">좌측에서 녹화본을 선택해주세요</p>
          </div>
        </div>
      );
    }

    const recording = recordings.find((r) => r.id === selectedRecordingId);
    if (!recording) return null;

    return (
      <VideoPlayer
        recordingId={selectedRecordingId}
        videoUrl={recording.recordingUrl}
        subtitleUrl={recording.subtitles?.[0] || ''}
      />
    );
  };

  const getStatusBadge = (
    status: string
  ): { text: string; bgColor: string } => {
    const statusMap: Record<string, { text: string; bgColor: string }> = {
      uploaded: { text: '업로드됨', bgColor: 'bg-blue-100 text-blue-800' },
      queued: { text: '대기 중', bgColor: 'bg-yellow-100 text-yellow-800' },
      processing: { text: '처리 중...', bgColor: 'bg-orange-100 text-orange-800' },
      completed: { text: '완료', bgColor: 'bg-green-100 text-green-800' },
      failed: { text: '실패', bgColor: 'bg-red-100 text-red-800' },
    };
    return statusMap[status] || { text: status, bgColor: 'bg-gray-100' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 p-4 bg-white rounded-lg shadow">
      {/* 좌측: 자료/녹화본 목록 */}
      <div className="w-64 flex flex-col border-r">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setActiveTab('material');
              setSelectedMaterialId(null);
            }}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
              activeTab === 'material'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            자료
          </button>
          <button
            onClick={() => {
              setActiveTab('recording');
              setSelectedRecordingId(null);
            }}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
              activeTab === 'recording'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            녹화본
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'material' ? (
            <div className="space-y-2">
              {materials.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">등록된 자료 없음</p>
              ) : (
                materials.map((material) => {
                  const statusBadge = getStatusBadge(
                    material.processingStatus
                  );
                  return (
                    <button
                      key={material.id}
                      onClick={() => setSelectedMaterialId(material.id)}
                      className={`w-full text-left px-3 py-2 rounded transition ${
                        selectedMaterialId === material.id
                          ? 'bg-blue-100 border-l-4 border-blue-500'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-sm font-medium truncate">
                        {material.title || material.fileName}
                      </p>
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded mt-1 ${statusBadge.bgColor}`}
                      >
                        {statusBadge.text}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">등록된 녹화본 없음</p>
              ) : (
                recordings.map((recording) => {
                  const sttStatusBadge = getStatusBadge(recording.sttStatus);
                  return (
                    <button
                      key={recording.id}
                      onClick={() => setSelectedRecordingId(recording.id)}
                      className={`w-full text-left px-3 py-2 rounded transition ${
                        selectedRecordingId === recording.id
                          ? 'bg-blue-100 border-l-4 border-blue-500'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-sm font-medium truncate">
                        {recording.title}
                      </p>
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded mt-1 ${sttStatusBadge.bgColor}`}
                      >
                        {sttStatusBadge.text}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 중앙: 콘텐츠 뷰어 */}
      <div className="flex-1 flex flex-col">
        <div className="mb-2">
          <h2 className="text-lg font-bold text-gray-800">{sessionTitle}</h2>
          <p className="text-xs text-gray-500">
            {activeTab === 'material' ? '자료 보기' : '녹화본 재생'}
          </p>
        </div>
        <div className="flex-1 bg-gray-50 rounded border border-gray-200 overflow-hidden">
          {activeTab === 'material'
            ? renderMaterialContent()
            : renderRecordingContent()}
        </div>
      </div>

      {/* 우측: Q&A/퀴즈 패널 (플레이스홀더) */}
      <div className="w-72 flex flex-col border-l pl-4">
        <div className="flex gap-2 mb-4">
          <button className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm font-medium">
            Q&A
          </button>
          <button className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300">
            퀴즈
          </button>
        </div>
        <div className="flex-1 bg-gray-50 rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-500 text-center">
            준비 중...
          </p>
        </div>
      </div>
    </div>
  );
}
