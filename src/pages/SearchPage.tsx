import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Film,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { ApiSetupGuide } from '../components/ApiSetupGuide';
import { MovieCard } from '../components/MovieCard';
import { GridSkeleton } from '../components/SkeletonLoader';
import { useCineFlix } from '../context/CineFlixContext';
import {
  getDisplayTitle,
  getProfileUrl,
  getTrendingAllDay,
  inferMediaType,
  rankResultsByGenreAffinity,
  searchMulti,
} from '../services/tmdb';
import { TMDBMediaItem } from '../types/tmdb';

type MediaTypeFilter = 'all' | 'movie' | 'tv' | 'person';
type SearchSortOption = 'personalized' | 'popularity' | 'rating' | 'year';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const {
    genreAffinity,
    genreMap,
    movieGenres,
    openDetailsModal,
    openTrailerModal,
  } = useCineFlix();

  const [inputValue, setInputValue] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('all');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SearchSortOption>('personalized');

  const [results, setResults] = useState<TMDBMediaItem[]>([]);
  const [suggestions, setSuggestions] = useState<TMDBMediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Sync input when URL search param changes externally (e.g. from Navbar)
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setInputValue(q);
    setDebouncedQuery(q);
  }, [searchParams]);

  // 300ms Debounce for live search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = inputValue.trim();
      setDebouncedQuery(trimmed);
      if (trimmed) {
        setSearchParams({ q: trimmed }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  // Load trending search suggestions when query is empty
  useEffect(() => {
    let isMounted = true;
    getTrendingAllDay(1)
      .then((res) => {
        if (!isMounted) return;
        setSuggestions(
          rankResultsByGenreAffinity(res.results || [], genreAffinity).slice(0, 12)
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        if (!debouncedQuery) {
          setError(err instanceof Error ? err : new Error('Unable to connect to TMDB.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [genreAffinity, debouncedQuery]);

  // Execute live multi-search when debouncedQuery changes
  const executeSearch = useCallback(
    async (queryToRun: string, targetPage: number, append = false) => {
      if (!queryToRun.trim()) {
        setResults([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await searchMulti(queryToRun, targetPage);
        const incoming = res.results || [];
        setResults((prev) => {
          if (!append) return incoming;
          const existingKeys = new Set(prev.map((i) => `${i.media_type}-${i.id}`));
          const uniqueNew = incoming.filter(
            (i) => !existingKeys.has(`${i.media_type}-${i.id}`)
          );
          return [...prev, ...uniqueNew];
        });
        setTotalPages(Math.min(res.total_pages || 1, 500));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Search request failed.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    executeSearch(debouncedQuery, 1, false);
  }, [debouncedQuery, executeSearch]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      executeSearch(debouncedQuery, nextPage, true);
    }
  };

  // Filtered and genre-affinity sorted results
  const processedResults = useMemo(() => {
    let list = [...results];

    if (typeFilter !== 'all') {
      list = list.filter((item) => item.media_type === typeFilter);
    }

    if (selectedGenre !== null) {
      list = list.filter((item) => {
        if (item.media_type === 'person') return false;
        return (item.genre_ids || []).includes(selectedGenre);
      });
    }

    if (sortBy === 'personalized') {
      return rankResultsByGenreAffinity(list, genreAffinity);
    }
    if (sortBy === 'popularity') {
      return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
    if (sortBy === 'rating') {
      return list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    }
    if (sortBy === 'year') {
      return list.sort((a, b) => {
        const dateA = a.release_date || a.first_air_date || '';
        const dateB = b.release_date || b.first_air_date || '';
        return dateB.localeCompare(dateA);
      });
    }
    return list;
  }, [results, typeFilter, selectedGenre, sortBy, genreAffinity]);

  const quickSuggestionTerms = useMemo(() => {
    return suggestions.slice(0, 6).map((item) => getDisplayTitle(item));
  }, [suggestions]);

  if (error) {
    return (
      <main className="pt-24 pb-16 min-h-[80vh]">
        <ApiSetupGuide
          error={error}
          onRetry={() => executeSearch(debouncedQuery, 1, false)}
        />
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 max-w-[1440px] mx-auto px-6 md:px-12 min-h-[80vh]">
      {/* Large Search Input Box */}
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-center mb-5">
          Search Movies, TV Series &amp; Cast
        </h1>

        <div className="relative flex items-center bg-[#121217] border border-white/15 focus-within:border-[#E50914] rounded-2xl px-5 py-4 shadow-2xl transition-colors">
          <Search className="w-5 h-5 text-zinc-400 shrink-0 mr-3.5" />
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search for titles, directors, actors, or genres..."
            aria-label="Search movies, TV shows, and people"
            autoFocus
            className="w-full bg-transparent text-base sm:text-lg text-white placeholder-zinc-500 focus:outline-none"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => setInputValue('')}
              aria-label="Clear search input"
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/[0.06] ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Suggestions */}
        {!debouncedQuery && quickSuggestionTerms.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-zinc-500 mr-1">Popular searches:</span>
            {quickSuggestionTerms.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setInputValue(term)}
                className="px-3 py-1 rounded-lg bg-[#14141A] hover:bg-white/10 border border-white/[0.08] text-xs text-zinc-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter & Sort Controls (Visible when searching) */}
      {debouncedQuery && (
        <div className="mt-10 pb-5 border-b border-white/[0.08] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Media Type Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-lg self-start">
              {(
                [
                  { id: 'all', label: 'All Results' },
                  { id: 'movie', label: 'Movies' },
                  { id: 'tv', label: 'TV Shows' },
                  { id: 'person', label: 'People' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-[#E50914] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort By Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-lg">
                <span className="px-2.5 text-xs text-zinc-400 inline-flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Rank:
                </span>
                {(
                  [
                    { id: 'personalized', label: 'Personalized HD Match' },
                    { id: 'popularity', label: 'Popularity' },
                    { id: 'rating', label: 'Rating' },
                    { id: 'year', label: 'Newest' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      sortBy === opt.id
                        ? 'bg-white text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(typeFilter !== 'all' || selectedGenre !== null || sortBy !== 'personalized') && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setSelectedGenre(null);
                    setSortBy('personalized');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Genre Filter Row */}
          {typeFilter !== 'person' && movieGenres.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <button
                type="button"
                onClick={() => setSelectedGenre(null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedGenre === null
                    ? 'bg-white/15 text-white font-semibold'
                    : 'bg-[#121216] text-zinc-400 hover:text-white'
                }`}
              >
                All Genres
              </button>
              {movieGenres.slice(0, 12).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    setSelectedGenre(selectedGenre === g.id ? null : g.id)
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedGenre === g.id
                      ? 'bg-[#E50914] text-white font-semibold'
                      : 'bg-[#121216] text-zinc-400 hover:text-white'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Results or Default Personalized Suggestions */}
      <div className="mt-8">
        {loading ? (
          <GridSkeleton count={12} />
        ) : !debouncedQuery ? (
          /* Personalized & Trending Discovery Grid when Search Input is Empty */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E50914]" />
                  <span>Recommended &amp; Trending Searches</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Prioritized by your genre preferences and HD trailer availability
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {suggestions.map((item) => (
                <MovieCard key={`${item.media_type}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        ) : processedResults.length === 0 ? (
          /* Friendly No-Results State */
          <div className="rounded-2xl bg-[#111115] border border-white/10 p-12 text-center max-w-lg mx-auto my-8 space-y-4">
            <Film className="w-10 h-10 text-zinc-600 mx-auto" />
            <h2 className="text-xl font-bold text-white">
              No matches found for &ldquo;{debouncedQuery}&rdquo;
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Try searching for another movie title, television series, actor, or clear your
              active filters.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setSelectedGenre(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => setInputValue('')}
                className="px-4 py-2 text-xs font-semibold bg-[#E50914] hover:bg-[#F40612] text-white rounded-lg transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {processedResults.map((item) => {
                if (item.media_type === 'person') {
                  const profileUrl = getProfileUrl(item.profile_path, 'h632');
                  const knownForFirst = item.known_for?.[0];
                  return (
                    <article
                      key={`person-${item.id}`}
                      onClick={() => {
                        if (knownForFirst) {
                          openDetailsModal(knownForFirst);
                        }
                      }}
                      className="group flex flex-col rounded-xl cursor-pointer"
                    >
                      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#121216] border border-white/[0.08] group-hover:scale-[1.03] transition-transform duration-200">
                        {profileUrl ? (
                          <img
                            src={profileUrl}
                            alt={getDisplayTitle(item)}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#141418]">
                            <User className="w-10 h-10 text-zinc-600 mb-2" />
                            <span className="text-sm font-semibold text-zinc-200">
                              {getDisplayTitle(item)}
                            </span>
                          </div>
                        )}
                        {knownForFirst && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3.5 flex flex-col justify-end">
                            <p className="text-[11px] text-zinc-400">Known For:</p>
                            <p className="text-xs font-semibold text-white truncate">
                              {getDisplayTitle(knownForFirst)}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTrailerModal({
                                  ...knownForFirst,
                                  media_type: inferMediaType(knownForFirst),
                                });
                              }}
                              className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-[#E50914] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Featured Trailer</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2.5 px-0.5">
                        <h3 className="text-sm font-semibold text-zinc-100 truncate">
                          {getDisplayTitle(item)}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                          <span>{item.known_for_department || 'Person'}</span>
                          {knownForFirst && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{getDisplayTitle(knownForFirst)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                }

                return (
                  <MovieCard
                    key={`${item.media_type || 'media'}-${item.id}`}
                    item={item}
                  />
                );
              })}
            </div>

            {/* Load More Pagination */}
            {page < totalPages && (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-xl bg-[#E50914] hover:bg-[#F40612] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {loadingMore ? 'Loading More Results...' : 'Load More Results'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};
