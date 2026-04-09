'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  recordingId: string;
  videoUrl: string;
  subtitleUrl?: string;
}

export function VideoPlayer({
  recordingId,
  videoUrl,
  subtitleUrl,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState('');

  // 자막 업데이트 핸들러
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks.length) return;


    const handleCueChange = () => {
      const textTrack = video.textTracks[0];
      if (textTrack && textTrack.activeCues && textTrack.activeCues.length > 0) {
        const cue = textTrack.activeCues[0] as VTTCue;
        setCurrentSubtitle(cue.text || '');
      } else {
        setCurrentSubtitle('');
      }
    };
    const textTrack = video.textTracks[0];
    textTrack.addEventListener('cuechange', handleCueChange);

    return () => {
      textTrack.removeEventListener('cuechange', handleCueChange);
    };
  }, []);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeChange = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full flex-col bg-black">
      {/* 비디오 플레이어 */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="h-full w-full object-contain"
        >
          {subtitleUrl && (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang="ko"
              label="Korean"
              default
            />
          )}
        </video>

        {/* 자막 오버레이 */}
        {showSubtitles && currentSubtitle && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center">
            <div className="rounded bg-black/80 px-4 py-2 text-center">
              <p className="text-sm font-medium text-white">{currentSubtitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* 컨트롤 바 */}
      <div className="bg-gray-900 px-4 py-3">
        {/* 타임라인 */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
          className="w-full cursor-pointer"
        />

        <div className="mt-2 flex items-center gap-3">
          {/* 재생/일시정지 버튼 */}
          <button
            onClick={handlePlayPause}
            className="rounded bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm font-medium"
          >
            {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
          </button>

          {/* 자막 토글 */}
          {subtitleUrl && (
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                showSubtitles
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {showSubtitles ? '🔤 자막 ON' : '🔤 자막 OFF'}
            </button>
          )}

          {/* 시간 표시 */}
          <div className="ml-auto text-sm font-medium text-white">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-2 text-gray-400">/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* 녹화본 메타정보 */}
          <div className="text-xs text-gray-400 ml-2">
            <span>녹화본 ID: {recordingId.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
