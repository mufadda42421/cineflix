import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ApiSetupGuide } from '../components/ApiSetupGuide';
import { MovieCard } from '../components/MovieCard';
import { GridSkeleton } from '../components/SkeletonLoader';
import { useCineFlix } from '../context/CineFlixContext';
import {
  DiscoverParams,
  TMDBMediaItem,
} from '../types/tmdb';
import {
  discoverMovies,
  discoverTV,
  getTrendingAllDay,
} from '../services/tmdb';

interface BrowsePageProps {
  mode: 'movie' | 'tv' | 'trending';
}

type SortOption = 'popularity.desc' | 'vote_average.desc' | 'release_date.desc';

export const BrowsePage: React.FC<BrowsePageProps> = ({ mode }) => {
  const { movieGenres, tvGenres } = useCineFlix();

  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('popularity.desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState<TMDBMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Reset filters when mode changes
  useEffect(() => {
    setSelectedGenre(null);
    setSortBy('popularity.desc');
    setPage(1);
  }, [mode]);

  const genres = mode === 'tv' ? tvGenres : movieGenres;

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'trending') {
        const res = await getTrendingAllDay(page);
        let filtered = res.results || [];
        if (selectedGenre) {
          filtered = filtered.filter((item) =>
            (item.genre_ids || []).includes(selectedGenre)
          );
        }
        setItems(filtered);
        setTotalPages(Math.min(res.total_pages || 1, 500));
      } else {
        const apiSort: DiscoverParams['sort_by'] =
          sortBy === 'release_date.desc'
            ? mode === 'movie'
              ? 'primary_release_date.desc'
              : 'first_air_date.desc'
            : sortBy;

        const params: DiscoverParams = {
          page,
          sort_by: apiSort,
          with_genres: selectedGenre ? String(selectedGenre) : undefined,
        };

        const res =
          mode === 'movie' ? await discoverMovies(params) : await discoverTV(params);

        setItems(res.results || []);
        setTotalPages(Math.min(res.total_pages || 1, 500));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load catalog.'));
    } finally {
      setLoading(false);
    }
  }, [mode, page, selectedGenre, sortBy]);

  useEffect(() => {
    fetchCatalog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const handleKeyUpdate = () => {
      fetchCatalog();
    };
    window.addEventListener('cineflix-tmdb-key-updated', handleKeyUpdate);
    return () => {
      window.removeEventListener('cineflix-tmdb-key-updated', handleKeyUpdate);
    };
  }, [fetchCatalog]);

  const handleClearFilters = () => {
    setSelectedGenre(null);
    setSortBy('popularity.desc');
    setPage(1);
  };

  const hasActiveFilters = selectedGenre !== null || sortBy !== 'popularity.desc' || page > 1;

  const pageTitle =
    mode === 'movie'
      ? 'Explore Movies'
      : mode === 'tv'
      ? 'Explore TV Shows'
      : 'Trending Today';

  const pageSubtitle =
    mode === 'movie'
      ? 'Discover theatrical releases, award-winning films, and genre classics from TMDB'
      : mode === 'tv'
      ? 'Browse acclaimed television series, miniseries, and global originals'
      : 'Real-time daily trending movies and series across the globe';

  if (error) {
    return (
      <main className="pt-24 pb-16 min-h-[80vh]">
        <ApiSetupGuide error={error} onRetry={fetchCatalog} />
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 max-w-[1440px] mx-auto px-6 md:px-12 min-h-[80vh]">
      {/* Page Header & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {pageTitle}
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5">{pageSubtitle}</p>
        </div>

        {/* Sort Controls & Reset */}
        <div className="flex flex-wrap items-center gap-3">
          {mode !== 'trending' && (
            <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-lg">
              <span className="px-2.5 text-xs text-zinc-400 inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Sort:
              </span>
              {(
                [
                  { id: 'popularity.desc', label: 'Popularity' },
                  { id: 'vote_average.desc', label: 'Top Rated' },
                  { id: 'release_date.desc', label: 'Release Date' },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSortBy(option.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sortBy === option.id
                      ? 'bg-[#E50914] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Genre Filter Bar */}
      {genres.length > 0 && (
        <div className="py-5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setSelectedGenre(null);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedGenre === null
                ? 'bg-white text-black'
                : 'bg-[#141418] text-zinc-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => {
            const active = selectedGenre === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGenre(active ? null : g.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#E50914] text-white'
                    : 'bg-[#141418] text-zinc-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Results Grid */}
      <div className="mt-4">
        {loading ? (
          <GridSkeleton count={18} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-[#111115] border border-white/10 p-12 text-center max-w-lg mx-auto my-8 space-y-4">
            <h2 className="text-xl font-bold text-white">No Matching Titles Found</h2>
            <p className="text-sm text-zinc-400">
              No titles matched your selected genre and filter combination.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 text-xs font-semibold bg-[#E50914] hover:bg-[#F40612] text-white rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {items.map((item) => (
                <MovieCard
                  key={`${item.media_type || mode}-${item.id}`}
                  item={
                    mode === 'movie' || mode === 'tv'
                      ? { ...item, media_type: mode }
                      : item
                  }
                />
              ))}
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="mt-12 pt-6 border-t border-white/[0.08] flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141418] hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Page</span>
                </button>

                <div className="text-xs text-zinc-400 font-mono-tabular">
                  Page <span className="text-white font-semibold">{page}</span> of{' '}
                  <span className="text-zinc-300">{totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Next Page</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};
