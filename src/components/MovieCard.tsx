import React, { useState } from 'react';
import { Check, Film, Info, Play, Plus, Star, Trash2, Tv } from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  getDisplayTitle,
  getPosterUrl,
  getReleaseYear,
  inferMediaType,
} from '../services/tmdb';
import { TMDBMediaItem } from '../types/tmdb';

interface MovieCardProps {
  item: TMDBMediaItem;
  showRemoveButton?: boolean;
  onRemove?: (id: number, mediaType: 'movie' | 'tv') => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  item,
  showRemoveButton = false,
  onRemove,
}) => {
  const {
    isInWatchlist,
    toggleWatchlist,
    openDetailsModal,
    openTrailerModal,
    openWatchPlayer,
    genreMap,
  } = useCineFlix();

  const [imgError, setImgError] = useState(false);

  const mediaType = inferMediaType(item);
  const title = getDisplayTitle(item);
  const year = getReleaseYear(item);
  const posterUrl = getPosterUrl(item.poster_path, 'w500');
  const inWatchlist = isInWatchlist(item.id, mediaType);
  const rating = item.vote_average && item.vote_average > 0 ? item.vote_average.toFixed(1) : 'NR';

  const primaryGenre =
    item.genre_ids && item.genre_ids.length > 0 ? genreMap[item.genre_ids[0]] : undefined;

  const handleCardClick = () => {
    openDetailsModal(item);
  };

  const handleWatchNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    openWatchPlayer(item);
  };

  const handlePlayTrailer = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTrailerModal(item);
  };

  const handleMoreInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDetailsModal(item);
  };

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showRemoveButton && onRemove) {
      onRemove(item.id, mediaType);
    } else {
      toggleWatchlist(item);
    }
  };

  return (
    <article
      className="group relative flex flex-col select-none cursor-pointer focus-within:ring-2 focus-within:ring-[#E50914] rounded-xl"
      onClick={handleCardClick}
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#121216] border border-white/[0.08] transition-transform duration-200 ease-out group-hover:scale-[1.03] group-hover:border-white/20 shadow-lg">
        {posterUrl && !imgError ? (
          <img
            src={posterUrl}
            alt={`${title} (${year}) poster`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          /* Zero-Broken-Image Policy: Styled Fallback Container */
          <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-gradient-to-br from-[#18181F] via-[#111115] to-[#0A0A0D]">
            {mediaType === 'tv' ? (
              <Tv className="w-10 h-10 text-zinc-600 mb-3" />
            ) : (
              <Film className="w-10 h-10 text-zinc-600 mb-3" />
            )}
            <span className="font-display text-sm font-semibold text-zinc-200 line-clamp-3">
              {title}
            </span>
            <span className="text-xs text-zinc-500 mt-1.5 font-mono-tabular">{year}</span>
          </div>
        )}

        {/* Hover Scrim & Action Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/65 to-black/10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3.5">
          <div className="space-y-2">
            <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
              {item.overview || 'Stream full feature, explore cast, or watch official HD trailers.'}
            </p>

            {/* Primary Action: Watch Movie / Series Now */}
            <button
              type="button"
              onClick={handleWatchNow}
              aria-label={`Watch ${title} now`}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Watch Now</span>
            </button>

            {/* Secondary Actions Row: Trailer, Details & My List */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePlayTrailer}
                aria-label={`Play trailer for ${title}`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium backdrop-blur-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Film className="w-3 h-3" />
                <span>Trailer</span>
              </button>

              <button
                type="button"
                onClick={handleMoreInfo}
                aria-label={`More info for ${title}`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium backdrop-blur-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Info className="w-3 h-3" />
                <span>Info</span>
              </button>

              <button
                type="button"
                onClick={handleWatchlistToggle}
                aria-label={
                  showRemoveButton
                    ? `Remove ${title} from My List`
                    : inWatchlist
                    ? `Remove ${title} from My List`
                    : `Add ${title} to My List`
                }
                title={inWatchlist ? 'Remove from My List' : 'Add to My List'}
                className={`p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                  showRemoveButton
                    ? 'bg-red-950/80 border-red-500/40 text-red-200 hover:bg-red-900'
                    : inWatchlist
                    ? 'bg-white text-black border-white hover:bg-zinc-200'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                {showRemoveButton ? (
                  <Trash2 className="w-3.5 h-3.5" />
                ) : inWatchlist ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer: Title + Clean Unboxed Metadata (Zero-Pill Discipline) */}
      <div className="mt-2.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
            {title}
          </h3>
          {showRemoveButton && onRemove && (
            <button
              type="button"
              onClick={handleWatchlistToggle}
              aria-label={`Remove ${title} from My List`}
              className="text-zinc-500 hover:text-[#E50914] transition-colors shrink-0 p-0.5 cursor-pointer"
              title="Remove from My List"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400 truncate">
          <span className="inline-flex items-center gap-1 text-amber-400 font-mono-tabular font-medium">
            <Star className="w-3 h-3 fill-current" />
            {rating}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{year}</span>
          {primaryGenre && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate text-zinc-400">{primaryGenre}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
