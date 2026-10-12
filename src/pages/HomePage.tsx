import React, { useCallback, useEffect, useState } from 'react';
import { ApiSetupGuide } from '../components/ApiSetupGuide';
import { HeroBanner } from '../components/HeroBanner';
import { MovieRow } from '../components/MovieRow';
import { PersonalizedSpotlight } from '../components/PersonalizedSpotlight';
import { useCineFlix } from '../context/CineFlixContext';
import {
  TMDBApiError,
  discoverMovies,
  getPopularMovies,
  getPopularTV,
  getRecommendations,
  getTopRatedMovies,
  getTopRatedTV,
  getTrendingAllDay,
  getUpcomingMovies,
  rankResultsByGenreAffinity,
} from '../services/tmdb';
import { TMDBMediaItem } from '../types/tmdb';

interface HomeCatalogState {
  trending: TMDBMediaItem[];
  recommended: TMDBMediaItem[];
  popularMovies: TMDBMediaItem[];
  topRatedMovies: TMDBMediaItem[];
  upcomingMovies: TMDBMediaItem[];
  popularTV: TMDBMediaItem[];
  topRatedTV: TMDBMediaItem[];
  actionAdventure: TMDBMediaItem[];
  sciFi: TMDBMediaItem[];
  comedy: TMDBMediaItem[];
  horror: TMDBMediaItem[];
}

const INITIAL_CATALOG: HomeCatalogState = {
  trending: [],
  recommended: [],
  popularMovies: [],
  topRatedMovies: [],
  upcomingMovies: [],
  popularTV: [],
  topRatedTV: [],
  actionAdventure: [],
  sciFi: [],
  comedy: [],
  horror: [],
};

export const HomePage: React.FC = () => {
  const { getTopAffinityGenres, genreAffinity, genreMap, watchlist } = useCineFlix();

  const [catalog, setCatalog] = useState<HomeCatalogState>(INITIAL_CATALOG);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<Error | TMDBApiError | null>(null);

  const loadHomepageData = useCallback(async () => {
    setLoading(true);
    setFatalError(null);

    const topGenres = getTopAffinityGenres(2);
    const genreQuery = topGenres.length > 0 ? topGenres.join('|') : '28|878';
    const seedWatchlistItem = watchlist[0];

    try {
      const results = await Promise.allSettled([
        getTrendingAllDay(1),
        seedWatchlistItem
          ? getRecommendations(seedWatchlistItem.media_type, seedWatchlistItem.id, 1)
          : discoverMovies({ with_genres: genreQuery, sort_by: 'popularity.desc', page: 1 }),
        getPopularMovies(1),
        getTopRatedMovies(1),
        getUpcomingMovies(1),
        getPopularTV(1),
        getTopRatedTV(1),
        discoverMovies({ with_genres: '28,12', sort_by: 'popularity.desc', page: 1 }),
        discoverMovies({ with_genres: '878', sort_by: 'popularity.desc', page: 1 }),
        discoverMovies({ with_genres: '35', sort_by: 'popularity.desc', page: 1 }),
        discoverMovies({ with_genres: '27', sort_by: 'popularity.desc', page: 1 }),
      ]);

      // Check if all requests failed (e.g. missing or invalid TMDB token)
      const firstRejected = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      const anyFulfilled = results.some((r) => r.status === 'fulfilled');

      if (!anyFulfilled && firstRejected) {
        setFatalError(
          firstRejected.reason instanceof Error
            ? firstRejected.reason
            : new Error('Failed to fetch catalog from TMDB.')
        );
        setLoading(false);
        return;
      }

      const extract = (idx: number): TMDBMediaItem[] => {
        const r = results[idx];
        return r && r.status === 'fulfilled' ? r.value.results || [] : [];
      };

      const rawRecommended = extract(1);
      const fallbackRecommended =
        rawRecommended.length > 0 ? rawRecommended : extract(0).slice(4, 18);

      setCatalog({
        trending: extract(0),
        recommended: rankResultsByGenreAffinity(fallbackRecommended, genreAffinity),
        popularMovies: extract(2),
        topRatedMovies: extract(3),
        upcomingMovies: extract(4),
        popularTV: extract(5),
        topRatedTV: extract(6),
        actionAdventure: extract(7),
        sciFi: extract(8),
        comedy: extract(9),
        horror: extract(10),
      });
    } catch (err) {
      setFatalError(
        err instanceof Error ? err : new Error('Unexpected error loading homepage.')
      );
    } finally {
      setLoading(false);
    }
  }, [getTopAffinityGenres, genreAffinity, watchlist]);

  useEffect(() => {
    loadHomepageData();
    const handleKeyUpdate = () => {
      loadHomepageData();
    };
    window.addEventListener('cineflix-tmdb-key-updated', handleKeyUpdate);
    return () => {
      window.removeEventListener('cineflix-tmdb-key-updated', handleKeyUpdate);
    };
  }, [loadHomepageData]);

  if (fatalError) {
    return (
      <main className="pt-24 pb-16 min-h-[80vh]">
        <ApiSetupGuide error={fatalError} onRetry={loadHomepageData} />
      </main>
    );
  }

  const topGenreNames = getTopAffinityGenres(3)
    .map((id) => genreMap[id])
    .filter(Boolean);

  const recommendedSubtitle =
    topGenreNames.length > 0
      ? `Personalized for your interest in ${topGenreNames.join(' · ')}`
      : 'Curated based on top-rated cinema and your activity';

  return (
    <main className="pb-12">
      {/* Hero Banner */}
      <HeroBanner items={catalog.trending} loading={loading} />

      {/* Content Carousels */}
      <div className="space-y-2 md:space-y-4 -mt-6 relative z-20">
        <PersonalizedSpotlight fallbackItems={catalog.recommended} />

        <MovieRow
          title="Trending Now"
          subtitle="Today's most watched movies and series across TMDB"
          items={catalog.trending}
          loading={loading}
        />

        <MovieRow
          title="Recommended For You"
          subtitle={recommendedSubtitle}
          items={catalog.recommended}
          loading={loading}
        />

        <MovieRow
          title="Popular Movies"
          items={catalog.popularMovies}
          loading={loading}
        />

        <MovieRow
          title="Popular TV Shows"
          items={catalog.popularTV}
          loading={loading}
        />

        <MovieRow
          title="Top Rated Movies"
          subtitle="Critically acclaimed cinema of all time"
          items={catalog.topRatedMovies}
          loading={loading}
        />

        <MovieRow
          title="Action & Adventure"
          items={catalog.actionAdventure}
          loading={loading}
        />

        <MovieRow
          title="Sci-Fi"
          items={catalog.sciFi}
          loading={loading}
        />

        <MovieRow
          title="Upcoming Movies"
          subtitle="Theatrical releases arriving soon"
          items={catalog.upcomingMovies}
          loading={loading}
        />

        <MovieRow
          title="Top Rated TV Shows"
          items={catalog.topRatedTV}
          loading={loading}
        />

        <MovieRow
          title="Comedy"
          items={catalog.comedy}
          loading={loading}
        />

        <MovieRow
          title="Horror"
          items={catalog.horror}
          loading={loading}
        />
      </div>
    </main>
  );
};
