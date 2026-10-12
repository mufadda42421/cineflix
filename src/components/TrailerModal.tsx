import React, { useEffect, useState } from 'react';
import { ExternalLink, Film, Play, X } from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import { getMediaVideos, sortVideosByHDQuality } from '../services/tmdb';
import { TMDBVideo } from '../types/tmdb';

export const TrailerModal: React.FC = () => {
  const { activeTrailer, closeTrailerModal } = useCineFlix();

  const [videos, setVideos] = useState<TMDBVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<TMDBVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTrailer) {
      setVideos([]);
      setSelectedVideo(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getMediaVideos(activeTrailer.mediaType, activeTrailer.id)
      .then((res) => {
        if (!isMounted) return;
        const sorted = sortVideosByHDQuality(res.results || []);
        setVideos(sorted);

        if (activeTrailer.videoKey) {
          const explicitMatch = sorted.find((v) => v.key === activeTrailer.videoKey);
          setSelectedVideo(explicitMatch || sorted[0] || null);
        } else {
          setSelectedVideo(sorted[0] || null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load trailer videos from TMDB.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTrailer]);

  // Keyboard ESC handler & body scroll lock
  useEffect(() => {
    if (!activeTrailer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTrailerModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTrailer, closeTrailerModal]);

  if (!activeTrailer) return null;

  const formatResolutionLabel = (size?: number) => {
    if (!size) return 'HD';
    if (size >= 2160) return '4K UHD';
    if (size >= 1080) return '1080p HD';
    if (size >= 720) return '720p HD';
    return `${size}p`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${activeTrailer.title} Trailer Player`}
      onClick={closeTrailerModal}
    >
      <div
        className="relative w-full max-w-5xl bg-[#101014] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-[#0A0A0D] border-b border-white/[0.08]">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white truncate">
              {activeTrailer.title}
            </h2>
            {selectedVideo && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 truncate mt-0.5">
                <span className="truncate">{selectedVideo.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-zinc-300">
                  {formatResolutionLabel(selectedVideo.size)}
                </span>
                {selectedVideo.official && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#E50914] font-medium">Official</span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={closeTrailerModal}
            aria-label="Close trailer player"
            className="p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 16:9 Responsive Video Viewport */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <div className="w-10 h-10 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Loading official HD trailer...</span>
            </div>
          ) : selectedVideo ? (
            <iframe
              key={selectedVideo.key}
              src={`https://www.youtube-nocookie.com/embed/${selectedVideo.key}?autoplay=1&rel=0&modestbranding=1`}
              title={`${activeTrailer.title} - ${selectedVideo.name}`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="max-w-md text-center p-8 space-y-4">
              <Film className="w-12 h-12 text-zinc-600 mx-auto" />
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-white">No Official Trailer Available</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {error ||
                    `TMDB does not currently list an official YouTube trailer for "${activeTrailer.title}".`}
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    `${activeTrailer.title} official trailer`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <span>Search Trailer on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={closeTrailerModal}
                  className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Additional Official Videos / Teasers Selector */}
        {videos.length > 1 && (
          <div className="px-5 py-3.5 bg-[#0C0C10] border-t border-white/[0.08] overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-zinc-400 whitespace-nowrap mr-1">
                More Videos ({videos.length}):
              </span>
              {videos.slice(0, 8).map((video) => {
                const isSelected = selectedVideo?.key === video.key;
                return (
                  <button
                    key={video.id || video.key}
                    type="button"
                    onClick={() => setSelectedVideo(video)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#E50914] text-white font-semibold'
                        : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span className="max-w-[180px] truncate">{video.name}</span>
                    <span className="opacity-75 font-mono-tabular">
                      ({formatResolutionLabel(video.size)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
