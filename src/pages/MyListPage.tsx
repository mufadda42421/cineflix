import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Cloud,
  Compass,
  Film,
  LogIn,
  Tv,
  User as UserIcon,
} from 'lucide-react';
import { MovieCard } from '../components/MovieCard';
import { useCineFlix } from '../context/CineFlixContext';
import { TMDBMediaItem } from '../types/tmdb';

export const MyListPage: React.FC = () => {
  const {
    user,
    userProfile,
    watchlist,
    viewingHistory,
    removeFromWatchlist,
    removeFromHistory,
    openProfileModal,
  } = useCineFlix();

  const [activeCollection, setActiveCollection] = useState<'watchlist' | 'history'>(
    'watchlist'
  );
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');

  const sourceList = activeCollection === 'watchlist' ? watchlist : viewingHistory;

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return sourceList;
    return sourceList.filter((item) => item.media_type === filterType);
  }, [sourceList, filterType]);

  return (
    <main className="pt-24 pb-16 max-w-[1440px] mx-auto px-6 md:px-12 min-h-[80vh]">
      {/* Cloud Account Status Banner */}
      <div className="mb-8 rounded-2xl bg-[#111116] border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#E50914] shrink-0">
            {user ? <Cloud className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              {user
                ? `${userProfile?.displayName || user.displayName || 'Member'}'s Cloud Library`
                : 'Guest Local Watchlist'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {user
                ? `Synced in real time across your devices with Firebase (${user.email})`
                : 'Sign in with Google to synchronize your My List and viewing history across all devices.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openProfileModal}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            user
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-[#E50914] hover:bg-[#F40612] text-white'
          }`}
        >
          {user ? (
            <>
              <UserIcon className="w-3.5 h-3.5" />
              <span>Manage Profile</span>
            </>
          ) : (
            <>
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Sync</span>
            </>
          )}
        </button>
      </div>

      {/* Header & Collection Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {activeCollection === 'watchlist' ? 'My List' : 'Viewing History'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5">
            {activeCollection === 'watchlist'
              ? `Saved movies and TV series (${watchlist.length} ${
                  watchlist.length === 1 ? 'title' : 'titles'
                })`
              : `Recently streamed movies and episodes (${viewingHistory.length} ${
                  viewingHistory.length === 1 ? 'title' : 'titles'
                })`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Watchlist vs Viewing History Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-lg">
            <button
              type="button"
              onClick={() => setActiveCollection('watchlist')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCollection === 'watchlist'
                  ? 'bg-[#E50914] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              My List ({watchlist.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCollection('history')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCollection === 'history'
                  ? 'bg-[#E50914] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Viewing History ({viewingHistory.length})
            </button>
          </div>

          {/* Media Type Filter */}
          {sourceList.length > 0 && (
            <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'movie', label: 'Movies' },
                  { id: 'tv', label: 'TV Shows' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watchlist / History Content or Empty State */}
      {sourceList.length === 0 ? (
        <div className="max-w-lg mx-auto my-16 rounded-2xl bg-[#111115] border border-white/10 p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-[#E50914]">
            <Bookmark className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">
              {activeCollection === 'watchlist'
                ? 'Your Watchlist is Empty'
                : 'No Viewing History Yet'}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {activeCollection === 'watchlist'
                ? 'Save movies and television series to My List while browsing to keep track of what you want to watch next across all your devices.'
                : 'Click "Watch Now" on any movie or TV series to start streaming and build your personalized recommendation profile.'}
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/movies"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Film className="w-4 h-4" />
              <span>Browse Movies</span>
            </Link>
            <Link
              to="/tv"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Tv className="w-4 h-4" />
              <span>Browse TV Shows</span>
            </Link>
            <Link
              to="/trending"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Compass className="w-4 h-4" />
              <span>Trending Today</span>
            </Link>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-400">
          No {filterType === 'movie' ? 'movies' : 'TV shows'} in this view.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {filteredItems.map((saved) => {
            const mediaItem: TMDBMediaItem = {
              id: saved.id,
              media_type: saved.media_type,
              title: saved.title,
              name: saved.title,
              overview: saved.overview,
              poster_path: saved.poster_path,
              backdrop_path: saved.backdrop_path,
              release_date: saved.release_date,
              first_air_date: saved.release_date,
              vote_average: saved.vote_average,
              vote_count: 100,
              popularity: 100,
              genre_ids: saved.genre_ids,
            };
            return (
              <MovieCard
                key={`${activeCollection}-${saved.media_type}-${saved.id}`}
                item={mediaItem}
                showRemoveButton
                onRemove={
                  activeCollection === 'watchlist'
                    ? removeFromWatchlist
                    : removeFromHistory
                }
              />
            );
          })}
        </div>
      )}
    </main>
  );
};
