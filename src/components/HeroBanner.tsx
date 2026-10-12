import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  Play,
  Plus,
  Star,
} from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  getBackdropUrl,
  getDisplayTitle,
  getPosterUrl,
  getReleaseYear,
  inferMediaType,
} from '../services/tmdb';
import { TMDBMediaItem } from '../types/tmdb';
import { HeroSkeleton } from './SkeletonLoader';

interface HeroBannerProps {
  items: TMDBMediaItem[];
  loading?: boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ items, loading = false }) => {
  const {
    openDetailsModal,
    openTrailerModal,
    openWatchPlayer,
    toggleWatchlist,
    isInWatchlist,
    genreMap,
    activeDetails,
    activeTrailer,
    activeWatchPlayer,
  } = useCineFlix();

  const featuredItems = useMemo(() => {
    return items
      .filter(
        (item) => Boolean(item.backdrop_path || item.poster_path) && Boolean(item.overview)
      )
      .slice(0, 6);
  }, [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [backdropError, setBackdropError] = useState(false);

  const activeItem = featuredItems[currentIndex] || featuredItems[0];

  useEffect(() => {
    setBackdropError(false);
  }, [activeItem?.id]);

  // Auto-rotate featured titles every 8 seconds, pausing on user interaction or open modal
  useEffect(() => {
    if (
      featuredItems.length <= 1 ||
      isPaused ||
      Boolean(activeDetails) ||
      Boolean(activeTrailer) ||
      Boolean(activeWatchPlayer)
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [featuredItems.length, isPaused, activeDetails, activeTrailer, activeWatchPlayer]);

  if (loading) {
    return <HeroSkeleton />;
  }

  if (!activeItem) {
    return null;
  }

  const mediaType = inferMediaType(activeItem);
  const title = getDisplayTitle(activeItem);
  const year = getReleaseYear(activeItem);
  const rating =
    activeItem.vote_average && activeItem.vote_average > 0
      ? activeItem.vote_average.toFixed(1)
      : 'NR';
  const backdropUrl =
    getBackdropUrl(activeItem.backdrop_path, 'original') ||
    getPosterUrl(activeItem.poster_path, 'w780');
  const inWatchlist = isInWatchlist(activeItem.id, mediaType);

  const genreNames = (activeItem.genre_ids || [])
    .map((id) => genreMap[id])
    .filter(Boolean)
    .slice(0, 3);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredItems.length) % featuredItems.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
  };

  return (
    <section
      className="relative w-full min-h-[560px] lg:min-h-[700px] flex items-end pb-14 md:pb-20 pt-28 overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      aria-label="Featured Title Spotlight"
    >
      {/* Backdrop Image or Resilient Dark Gradient Fallback */}
      <div className="absolute inset-0 z-0 bg-[#080808]">
        {backdropUrl && !backdropError ? (
          <img
            key={backdropUrl}
            src={backdropUrl}
            alt={`${title} backdrop`}
            referrerPolicy="no-referrer"
            onError={() => setBackdropError(true)}
            className="w-full h-full object-cover object-center opacity-65 transition-opacity duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1F080A] via-[#0E0E12] to-[#080808]" />
        )}

        {/* Measured Contrast Scrims for 4.5:1 Legibility */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/80 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/35 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* Hero Foreground Content */}
      <div className="relative z-10 max-w-[1440px] mx-auto w-full px-6 md:px-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="max-w-2xl space-y-4">
          {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-medium text-zinc-300">
            <span className="text-[#E50914] font-semibold tracking-wide uppercase">
              {mediaType === 'tv' ? 'Featured Series' : 'Featured Film'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-amber-400 font-mono-tabular font-semibold">
              <Star className="w-3.5 h-3.5 fill-current" />
              {rating}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-zinc-200">{year}</span>
            {genreNames.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-300">{genreNames.join(' / ')}</span>
              </>
            )}
          </div>

          {/* Balanced Display Title */}
          <h1
            className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>

          {/* Overview Prose */}
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed line-clamp-3 max-w-xl">
            {activeItem.overview}
          </p>

          {/* Action Buttons: Watch Now (Full Stream) + Play Trailer + More Info + My List */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openWatchPlayer(activeItem)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white text-sm font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{mediaType === 'tv' ? 'Watch Series' : 'Watch Movie'}</span>
            </button>

            <button
              type="button"
              onClick={() => openTrailerModal(activeItem)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold backdrop-blur-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Film className="w-4 h-4" />
              <span>Play Trailer</span>
            </button>

            <button
              type="button"
              onClick={() => openDetailsModal(activeItem)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold backdrop-blur-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span>More Info</span>
            </button>

            <button
              type="button"
              onClick={() => toggleWatchlist(activeItem)}
              aria-label={inWatchlist ? `Remove ${title} from My List` : `Add ${title} to My List`}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inWatchlist
                  ? 'bg-white text-black border-white hover:bg-zinc-200'
                  : 'bg-black/40 border-white/25 text-white hover:bg-white/10 backdrop-blur-md'
              }`}
            >
              {inWatchlist ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>In My List</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>My List</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Carousel Rotation Controls */}
        {featuredItems.length > 1 && (
          <div className="flex items-center gap-3 self-start lg:self-end">
            <div className="flex items-center gap-1.5 mr-2">
              {featuredItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Show featured title ${idx + 1}: ${getDisplayTitle(item)}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'w-7 bg-[#E50914]'
                      : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous featured title"
              className="p-2 rounded-lg bg-black/50 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next featured title"
              className="p-2 rounded-lg bg-black/50 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
