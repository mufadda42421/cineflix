import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Film,
  Info,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  discoverMovies,
  getBackdropUrl,
  getDisplayTitle,
  getPosterUrl,
  getRecommendations,
  getReleaseYear,
  inferMediaType,
  rankResultsByGenreAffinity,
} from '../services/tmdb';
import { TMDBMediaItem } from '../types/tmdb';
import { MovieCard } from './MovieCard';

interface RecommendationSeed {
  key: string;
  label: string;
  reason: string;
  type: 'history' | 'watchlist' | 'genres';
  mediaId?: number;
  mediaType?: 'movie' | 'tv';
  genreIds?: number[];
}

export const PersonalizedSpotlight: React.FC<{ fallbackItems?: TMDBMediaItem[] }> = ({
  fallbackItems = [],
}) => {
  const {
    user,
    userProfile,
    viewingHistory,
    watchlist,
    genreAffinity,
    genreMap,
    getTopAffinityGenres,
    openWatchPlayer,
    openTrailerModal,
    openDetailsModal,
    openProfileModal,
    isInWatchlist,
    toggleWatchlist,
    removeFromHistory,
  } = useCineFlix();

  // Construct dynamic recommendation seeds from Viewing History, Watchlist, and Genre Preferences
  const seeds = useMemo<RecommendationSeed[]>(() => {
    const list: RecommendationSeed[] = [];

    // 1. Most recent watched titles (up to 2)
    for (const h of viewingHistory.slice(0, 2)) {
      list.push({
        key: `history-${h.media_type}-${h.id}`,
        label: `Because You Watched "${h.title}"`,
        reason: `Recommended by TMDB based on your recent stream of ${h.title}`,
        type: 'history',
        mediaId: h.id,
        mediaType: h.media_type,
      });
    }

    // 2. Most recent watchlist title (if not already in history seeds)
    for (const w of watchlist.slice(0, 2)) {
      if (!list.some((s) => s.mediaId === w.id && s.mediaType === w.media_type)) {
        list.push({
          key: `watchlist-${w.media_type}-${w.id}`,
          label: `From Your List: "${w.title}"`,
          reason: `Titles similar in tone and audience reception to ${w.title}`,
          type: 'watchlist',
          mediaId: w.id,
          mediaType: w.media_type,
        });
      }
    }

    // 3. Top affinity / profile favorite genres seed
    const topGenreIds =
      userProfile?.favoriteGenres && userProfile.favoriteGenres.length > 0
        ? userProfile.favoriteGenres.slice(0, 3)
        : getTopAffinityGenres(3);

    const genreNames = topGenreIds
      .map((id) => genreMap[id])
      .filter(Boolean)
      .join(' · ');

    list.push({
      key: `genres-${topGenreIds.join('_')}`,
      label: genreNames ? `Your Genres: ${genreNames}` : 'Top Genre Picks For You',
      reason: genreNames
        ? `Curated for your preference in ${genreNames}`
        : 'Personalized discovery based on your genre profile',
      type: 'genres',
      genreIds: topGenreIds.length > 0 ? topGenreIds : [28, 878, 18],
    });

    return list;
  }, [viewingHistory, watchlist, userProfile?.favoriteGenres, getTopAffinityGenres, genreMap]);

  const [selectedSeedKey, setSelectedSeedKey] = useState<string>('');
  const [recommendedItems, setRecommendedItems] = useState<TMDBMediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const activeSeed = useMemo(() => {
    return seeds.find((s) => s.key === selectedSeedKey) || seeds[0];
  }, [seeds, selectedSeedKey]);

  useEffect(() => {
    if (!activeSeed) return;

    let isMounted = true;
    setLoading(true);

    const fetchRecs = async () => {
      try {
        if (
          (activeSeed.type === 'history' || activeSeed.type === 'watchlist') &&
          activeSeed.mediaId &&
          activeSeed.mediaType
        ) {
          const res = await getRecommendations(
            activeSeed.mediaType,
            activeSeed.mediaId,
            1
          );
          if (!isMounted) return;
          const results = res.results || [];
          if (results.length > 0) {
            setRecommendedItems(rankResultsByGenreAffinity(results, genreAffinity));
            setLoading(false);
            return;
          }
        }

        // Fallback or Genre-based discovery
        const gQuery = (activeSeed.genreIds || [28, 878]).join('|');
        const discRes = await discoverMovies({
          with_genres: gQuery,
          sort_by: 'popularity.desc',
          page: 1,
        });
        if (!isMounted) return;
        const results =
          discRes.results && discRes.results.length > 0
            ? discRes.results
            : fallbackItems;
        setRecommendedItems(rankResultsByGenreAffinity(results, genreAffinity));
      } catch {
        if (isMounted) {
          setRecommendedItems(rankResultsByGenreAffinity(fallbackItems, genreAffinity));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecs();

    return () => {
      isMounted = false;
    };
  }, [activeSeed, genreAffinity, fallbackItems]);

  const spotlightItem = recommendedItems[0];
  const gridItems = recommendedItems.slice(1, 7);

  const computeMatchScore = (item: TMDBMediaItem): number => {
    let base = Math.round((item.vote_average || 7.5) * 9.5);
    const ids = item.genre_ids || [];
    for (const id of ids) {
      if (genreAffinity[id]) {
        base += 3;
      }
    }
    return Math.min(99, Math.max(78, base));
  };

  return (
    <section
      className="py-6 max-w-[1440px] mx-auto px-6 md:px-12 space-y-8"
      aria-label="Personalized Recommendations and Continue Watching"
    >
      {/* 1. CONTINUE WATCHING ROW (Shown whenever viewingHistory has items) */}
      {viewingHistory.length > 0 && (
        <div className="rounded-2xl bg-[#101015] border border-white/[0.08] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#E50914]" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Continue Watching
                  {user && userProfile ? ` for ${userProfile.displayName}` : ''}
                </h2>
                <p className="text-xs text-zinc-400">
                  Pick up right where you left off · Synced across your sessions
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {viewingHistory.slice(0, 4).map((entry) => {
              const backdrop =
                getBackdropUrl(entry.backdrop_path, 'w1280') ||
                getPosterUrl(entry.poster_path, 'w500');
              const pct = Math.min(
                95,
                Math.max(
                  8,
                  Math.round(
                    (entry.progressSeconds / Math.max(1, entry.durationSeconds)) * 100
                  )
                )
              );

              const mediaItem: TMDBMediaItem = {
                id: entry.id,
                media_type: entry.media_type,
                title: entry.title,
                name: entry.title,
                overview: entry.overview,
                poster_path: entry.poster_path,
                backdrop_path: entry.backdrop_path,
                release_date: entry.release_date,
                first_air_date: entry.release_date,
                vote_average: entry.vote_average,
                vote_count: 100,
                popularity: 100,
                genre_ids: entry.genre_ids,
              };

              return (
                <div
                  key={`continue-${entry.media_type}-${entry.id}`}
                  onClick={() =>
                    openWatchPlayer(mediaItem, entry.seasonNumber, entry.episodeNumber)
                  }
                  className="group relative rounded-xl overflow-hidden bg-[#16161D] border border-white/[0.08] hover:border-white/25 transition-all cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-video w-full bg-black overflow-hidden">
                    {backdrop ? (
                      <img
                        src={backdrop}
                        alt={entry.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Film className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 flex items-center justify-center transition-colors">
                      <div className="w-11 h-11 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(entry.id, entry.media_type);
                      }}
                      aria-label={`Remove ${entry.title} from Continue Watching`}
                      title="Remove from history"
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 hover:bg-red-900/90 text-zinc-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Playback Progress Bar */}
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-[#E50914]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {entry.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 font-mono-tabular">
                        {entry.media_type === 'tv' ? (
                          <span>
                            S{entry.seasonNumber}:E{entry.episodeNumber}
                          </span>
                        ) : (
                          <span>Movie</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{pct}% watched</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#E50914] shrink-0">
                      Resume
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. VISUALLY DISTINCT PERSONALIZED RECOMMENDATIONS CONTAINER */}
      <div className="relative rounded-2xl bg-gradient-to-b from-[#141115] via-[#101014] to-[#0B0B0E] border border-white/[0.1] p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Section Header & Seed Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E50914]">
              <Sparkles className="w-4 h-4" />
              <span>
                {user && userProfile
                  ? `Personalized For ${userProfile.displayName}`
                  : 'Personalized Discovery Engine'}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Recommended For You
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              {activeSeed?.reason ||
                'Dynamically fetched from TMDB recommendation endpoints based on your viewing history and genre preferences'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seed Selector Buttons */}
            {seeds.map((seed) => {
              const isSelected = activeSeed?.key === seed.key;
              return (
                <button
                  key={seed.key}
                  type="button"
                  onClick={() => setSelectedSeedKey(seed.key)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#E50914] text-white shadow-sm'
                      : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {seed.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={openProfileModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#E50914]" />
              <span>{user ? 'Tune Genres' : 'Sign In & Customize'}</span>
            </button>
          </div>
        </div>

        {/* Spotlight Content Area */}
        {loading ? (
          <div className="py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            <div className="lg:col-span-5 h-72 rounded-xl bg-zinc-800/60" />
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="aspect-[2/3] rounded-xl bg-zinc-800/50" />
              <div className="aspect-[2/3] rounded-xl bg-zinc-800/50" />
              <div className="aspect-[2/3] rounded-xl bg-zinc-800/50 hidden sm:block" />
            </div>
          </div>
        ) : spotlightItem ? (
          <div className="mt-6 space-y-6">
            {/* Top Match Spotlight Feature Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch rounded-xl bg-[#0D0D11] border border-white/[0.08] overflow-hidden">
              <div className="lg:col-span-6 relative min-h-[240px] sm:min-h-[300px] bg-black overflow-hidden">
                {getBackdropUrl(spotlightItem.backdrop_path, 'w1280') ||
                getPosterUrl(spotlightItem.poster_path, 'w780') ? (
                  <img
                    src={
                      getBackdropUrl(spotlightItem.backdrop_path, 'w1280') ||
                      getPosterUrl(spotlightItem.poster_path, 'w780') ||
                      ''
                    }
                    alt={getDisplayTitle(spotlightItem)}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover opacity-85"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#0D0D11] via-[#0D0D11]/40 to-transparent" />
              </div>

              <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-300">
                  <span className="text-emerald-400 font-mono-tabular font-bold">
                    {computeMatchScore(spotlightItem)}% Match
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-400 font-mono-tabular font-semibold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {(spotlightItem.vote_average || 0).toFixed(1)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {getReleaseYear(spotlightItem)}
                  </span>
                  {(spotlightItem.genre_ids || []).length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-300">
                        {(spotlightItem.genre_ids || [])
                          .map((id) => genreMap[id])
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(' / ')}
                      </span>
                    </>
                  )}
                </div>

                <h3
                  className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  {getDisplayTitle(spotlightItem)}
                </h3>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-3">
                  {spotlightItem.overview ||
                    'Recommended based on your viewing profile and favorite genres.'}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openWatchPlayer(spotlightItem)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Watch Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openTrailerModal(spotlightItem)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Film className="w-4 h-4" />
                    <span>Play Trailer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openDetailsModal(spotlightItem)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Info className="w-4 h-4" />
                    <span>Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWatchlist(spotlightItem)}
                    aria-label="Toggle My List"
                    className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors shrink-0 cursor-pointer"
                  >
                    {isInWatchlist(
                      spotlightItem.id,
                      inferMediaType(spotlightItem)
                    ) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 6-Card Personalized Recommendations Grid */}
            {gridItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {gridItems.map((item) => (
                  <MovieCard
                    key={`rec-${item.media_type || 'movie'}-${item.id}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
};
