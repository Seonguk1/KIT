"use client";

import { useEffect, useRef, useState } from "react";

type VideoPlayerProps = {
  recordingId: string;
  recordingName: string;
  videoUrl: string;
  subtitleUrl: string | null;
  targetSeekMs?: number | null;
  onSeekSynced?: () => void;
  segments?: Array<{
    id: string;
    startMs: number;
    endMs: number;
    refinedText: string;
    rawText: string;
    pageNumber: number | null;
  }>;
  onSegmentClick?: (segment: {
    id: string;
    startMs: number;
    endMs: number;
    refinedText: string;
    rawText: string;
    pageNumber: number | null;
  }) => void;
  onSegmentPageJump?: (segment: {
    id: string;
    startMs: number;
    endMs: number;
    refinedText: string;
    rawText: string;
    pageNumber: number | null;
  }) => void;
};

export function VideoPlayer({
  recordingId,
  recordingName,
  videoUrl,
  subtitleUrl,
  targetSeekMs,
  onSeekSynced,
  segments = [],
  onSegmentClick,
  onSegmentPageJump,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(!!subtitleUrl);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

  useEffect(() => {
    if (targetSeekMs === null || targetSeekMs === undefined || !videoRef.current) {
      return;
    }

    videoRef.current.currentTime = targetSeekMs / 1000;
    setCurrentTime(targetSeekMs / 1000);
    onSeekSynced?.();
  }, [targetSeekMs, onSeekSynced]);

  // 자막 업데이트
  useEffect(() => {
    if (!videoRef.current || !showSubtitles) {
      setCurrentSubtitle(null);
      return;
    }

    function handleTimeUpdate() {
      const video = videoRef.current;
      if (!video || !video.textTracks.length) {
        return;
      }

      const track = video.textTracks[0];
      if (!track.activeCues) {
        return;
      }

      let subtitle = null;
      for (let i = 0; i < track.activeCues.length; i++) {
        const cue = track.activeCues[i];
        if (cue instanceof VTTCue) {
          subtitle = cue.text;
          break;
        }
      }

      setCurrentSubtitle(subtitle);
    }

    const video = videoRef.current;
    if (video) {
      video.addEventListener("timeupdate", handleTimeUpdate);
      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }
  }, [showSubtitles]);

  function togglePlayPause() {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = Number(e.currentTarget.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const activeSegmentId = segments.find(
    (segment) => currentTime * 1000 >= segment.startMs && currentTime * 1000 < segment.endMs,
  )?.id;

  return (
    <div className="rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
      {/* 헤더 */}
      <div className="border-b border-zinc-200 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">녹화본</p>
        <h3 className="mt-1 font-semibold text-zinc-950">{recordingName}</h3>
      </div>

      {/* 비디오 플레이어 */}
      <div className="relative mt-4 space-y-4">
        <div className="relative rounded-lg border border-zinc-300 bg-black overflow-hidden">
          {/* 비디오 태그 */}
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full aspect-video bg-black"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
            }}
          >
            {subtitleUrl ? (
              <track kind="subtitles" src={subtitleUrl} srcLang="ko" label="한국어" default />
            ) : null}
          </video>

          {/* 자막 오버레이 */}
          {showSubtitles && currentSubtitle ? (
            <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4">
              <div className="rounded bg-black/80 px-3 py-2">
                <p className="text-sm font-medium text-white">{currentSubtitle}</p>
              </div>
            </div>
          ) : null}

          {/* 재생 버튼 오버레이 */}
          <button
            type="button"
            onClick={() => void togglePlayPause()}
            className="absolute inset-0 flex items-center justify-center transition hover:bg-black/30"
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            {!isPlaying && (
              <div className="rounded-full bg-white/90 p-4 transition hover:bg-white">
                <div className="h-0 w-0 border-l-8 border-t-5 border-b-5 border-l-black border-t-transparent border-b-transparent" />
              </div>
            )}
          </button>
        </div>

        {/* 컨트롤 바 */}
        <div className="space-y-3 rounded-lg bg-zinc-50 p-4">
          {/* 시간 슬라이더 */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleTimeChange}
              className="w-full cursor-pointer accent-amber-600"
            />
            <div className="flex justify-between text-xs font-semibold text-zinc-600">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 컨트롤 버튼 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => void togglePlayPause()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
            >
              {isPlaying ? "⏸ 일시정지" : "▶ 재생"}
            </button>

            {subtitleUrl ? (
              <button
                type="button"
                onClick={() => setShowSubtitles(!showSubtitles)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  showSubtitles
                    ? "border border-amber-300 bg-amber-50 text-amber-900"
                    : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                {showSubtitles ? "✓ 자막 ON" : "자막 OFF"}
              </button>
            ) : (
              <span className="text-xs text-zinc-600">자막 없음</span>
            )}
          </div>
        </div>

        {/* 메타데이터 */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">녹화본 정보</p>
          <div className="mt-2 text-sm text-blue-800">
            <p>ID: <span className="font-mono text-xs">{recordingId.slice(0, 8)}...</span></p>
            <p>지속시간: {formatTime(duration)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">자막 세그먼트</p>
          {segments.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">표시할 자막 세그먼트가 없습니다.</p>
          ) : (
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
              {segments.map((segment) => {
                const text = segment.refinedText || segment.rawText;
                const isActive = activeSegmentId === segment.id;

                return (
                  <div
                    key={segment.id}
                    className={`rounded border px-3 py-2 text-xs transition ${
                      isActive
                        ? "border-amber-300 bg-amber-50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = segment.startMs / 1000;
                        }
                        onSegmentClick?.(segment);
                      }}
                      className="w-full text-left"
                    >
                      <p className="font-semibold text-zinc-700">
                        {formatTime(segment.startMs / 1000)} - {formatTime(segment.endMs / 1000)}
                      </p>
                      <p className="mt-1 text-zinc-800">{text}</p>
                    </button>
                    {segment.pageNumber !== null ? (
                      <button
                        type="button"
                        onClick={() => onSegmentPageJump?.(segment)}
                        className="mt-2 text-[11px] font-semibold text-amber-800 underline-offset-2 hover:underline"
                      >
                        페이지 p.{segment.pageNumber}로 이동
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
