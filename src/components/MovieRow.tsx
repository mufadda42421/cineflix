import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TMDBMediaItem } from '../types/tmdb';
import { MovieCard } from './MovieCard';
import { CardSkeleton } from './SkeletonLoader';

interface MovieRowProps {
  title: string;
  subtitle?: string;
  items: TMDBMediaItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  subtitle,
  items,
  loading = false,
  error = null,
  onRetry,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 12);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 12);
  };

  const handleScroll = (direction: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.8, 320);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!loading && !error && items.length === 0) {
    return null;
  }

  return (
    <section className="relative py-5 max-w-[1440px] mx-auto px-6 md:px-12 group/row">
      {/* Row Header */}
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Desktop Carousel Arrow Controls */}
        {!loading && items.length > 4 && (
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              aria-label={`Scroll ${title} left`}
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] disabled:opacity-30 disabled:pointer-events-none text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              aria-label={`Scroll ${title} right`}
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] disabled:opacity-30 disabled:pointer-events-none text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error ? (
        <div className="rounded-xl bg-[#121216] border border-white/10 p-5 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <CardSkeleton key={idx} />
          ))}
        </div>
      ) : (
        /* Horizontally Scrollable Carousel */
        <div
          ref={rowRef}
          onScroll={updateScrollState}
          className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1 -mx-1 px-1 snap-x snap-mandatory"
        >
          {items.map((item) => (
            <div
              key={`${item.media_type || 'media'}-${item.id}`}
              className="w-[155px] sm:w-[180px] md:w-[200px] lg:w-[210px] shrink-0 snap-start"
            >
              <MovieCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
