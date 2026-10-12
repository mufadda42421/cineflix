import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Film,
  Play,
  Plus,
  Share2,
  Star,
  User,
  X,
} from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  getBackdropUrl,
  getDisplayTitle,
  getMediaCredits,
  getMediaDetails,
  getMediaVideos,
  getPosterUrl,
  getProfileUrl,
  getRecommendations,
  getReleaseYear,
  getSimilarTitles,
  rankResultsByGenreAffinity,
  sortVideosByHDQuality,
} from '../services/tmdb';
import {
  CastMember,
  CrewMember,
  TMDBMediaDetails,
  TMDBMediaItem,
  TMDBVideo,
} from '../types/tmdb';
import { MovieCard } from './MovieCard';

interface DetailsViewProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  initialData?: TMDBMediaItem;
  onClose: () => void;
  isPage?: boolean;
}

export const DetailsViewContent: React.FC<DetailsViewProps> = ({
  mediaId,
  mediaType,
  initialData,
  onClose,
  isPage = false,
}) => {
  const {
    isInWatchlist,
    toggleWatchlist,
    openTrailerModal,
    openWatchPlayer,
    recordGenreInteraction,
    genreAffinity,
  } = useCineFlix();

  const [details, setDetails] = useState<TMDBMediaDetails | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [videos, setVideos] = useState<TMDBVideo[]>([]);
  const [recommendations, setRecommendations] = useState<TMDBMediaItem[]>([]);
  const [similar, setSimilar] = useState<TMDBMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRelatedTab, setActiveRelatedTab] = useState<'recommended' | 'similar'>(
    'recommended'
  );
  const [copiedShare, setCopiedShare] = useState(false);
  const [backdropErr, setBackdropErr] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setBackdropErr(false);

    Promise.allSettled([
      getMediaDetails(mediaType, mediaId),
      getMediaCredits(mediaType, mediaId),
      getMediaVideos(mediaType, mediaId),
      getRecommendations(mediaType, mediaId),
      getSimilarTitles(mediaType, mediaId),
    ]).then(([detailsRes, creditsRes, videosRes, recsRes, simRes]) => {
      if (!isMounted) return;

      if (detailsRes.status === 'fulfilled') {
        setDetails(detailsRes.value);
        if (detailsRes.value.genres?.length) {
          recordGenreInteraction(
            detailsRes.value.genres.map((g) => g.id),
            1
          );
        }
      } else {
        setError(
          detailsRes.reason instanceof Error
            ? detailsRes.reason.message
            : 'Unable to load title details.'
        );
      }

      if (creditsRes.status === 'fulfilled') {
        setCast((creditsRes.value.cast || []).slice(0, 12));
        setCrew(creditsRes.value.crew || []);
      }

      if (videosRes.status === 'fulfilled') {
        setVideos(sortVideosByHDQuality(videosRes.value.results || []).slice(0, 6));
      }

      if (recsRes.status === 'fulfilled') {
        const rankedRecs = rankResultsByGenreAffinity(
          recsRes.value.results || [],
          genreAffinity
        ).slice(0, 12);
        setRecommendations(rankedRecs);
      }

      if (simRes.status === 'fulfilled') {
        const rankedSim = rankResultsByGenreAffinity(
          simRes.value.results || [],
          genreAffinity
        ).slice(0, 12);
        setSimilar(rankedSim);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [mediaId, mediaType, recordGenreInteraction]);

  const displayData: Partial<TMDBMediaItem> = details || initialData || {};
  const title = getDisplayTitle(displayData);
  const year = getReleaseYear(displayData);
  const fullDate = displayData.release_date || displayData.first_air_date || 'TBA';
  const rating =
    displayData.vote_average && displayData.vote_average > 0
      ? displayData.vote_average.toFixed(1)
      : 'NR';

  const backdropUrl =
    getBackdropUrl(displayData.backdrop_path, 'original') ||
    getPosterUrl(displayData.poster_path, 'w780');

  const inWatchlist = isInWatchlist(mediaId, mediaType);

  const formatRuntime = () => {
    if (mediaType === 'movie' && details?.runtime) {
      const hrs = Math.floor(details.runtime / 60);
      const mins = details.runtime % 60;
      return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }
    if (mediaType === 'tv' && details) {
      const parts: string[] = [];
      if (details.number_of_seasons) {
        parts.push(
          `${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}`
        );
      }
      if (details.number_of_episodes) {
        parts.push(`${details.number_of_episodes} Episodes`);
      }
      return parts.join(' · ') || undefined;
    }
    return undefined;
  };

  const directors = crew
    .filter((c) => c.job === 'Director')
    .map((c) => c.name)
    .slice(0, 3);

  const creators = (details?.created_by || []).map((c) => c.name).slice(0, 3);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/title/${mediaType}/${mediaId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${title} — CineFlix`,
          text: `Check out ${title} on CineFlix`,
          url: shareUrl,
        });
        return;
      }
    } catch {
      // Fall back to clipboard copy
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // Fallback
    }
  };

  const runtimeLabel = formatRuntime();
  const genreNames = (details?.genres || []).map((g) => g.name);
  const relatedList =
    activeRelatedTab === 'recommended'
      ? recommendations.length > 0
        ? recommendations
        : similar
      : similar.length > 0
      ? similar
      : recommendations;

  return (
    <div className="bg-[#0E0E12] text-zinc-100 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Top Hero Backdrop Banner */}
      <div className="relative min-h-[340px] sm:min-h-[440px] w-full bg-[#08080A] flex items-end">
        {backdropUrl && !backdropErr ? (
          <img
            src={backdropUrl}
            alt={`${title} backdrop`}
            referrerPolicy="no-referrer"
            onError={() => setBackdropErr(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#23090C] via-[#101015] to-[#08080A]" />
        )}

        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/70 to-black/30"
          aria-hidden="true"
        />

        {/* Top Navigation / Close Bar */}
        <div className="absolute top-4 inset-x-4 sm:top-6 sm:inset-x-6 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black/65 hover:bg-black/85 border border-white/15 text-xs font-semibold text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Browsing</span>
          </button>

          {!isPage && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details modal"
              className="p-2 rounded-lg bg-black/65 hover:bg-black/85 border border-white/15 text-white backdrop-blur-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Title & Primary Actions Overlay */}
        <div className="relative z-10 w-full p-6 sm:p-10 space-y-4">
          {/* Unboxed Metadata Line */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-300 font-medium">
            <span className="text-[#E50914] font-semibold uppercase tracking-wide">
              {mediaType === 'tv' ? 'TV Series' : 'Feature Film'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-amber-400 font-mono-tabular font-semibold">
              <Star className="w-3.5 h-3.5 fill-current" />
              {rating}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{year}</span>
            {runtimeLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{runtimeLabel}</span>
              </>
            )}
            {genreNames.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-200">{genreNames.join(' / ')}</span>
              </>
            )}
          </div>

          <h1
            className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h1>

          {details?.tagline && (
            <p className="text-sm italic text-zinc-400">{details.tagline}</p>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const fallbackGenres = details ? details.genres.map((g) => g.id) : [];
                const itemToPlay: TMDBMediaItem = details ||
                  initialData || {
                    id: mediaId,
                    media_type: mediaType,
                    title,
                    overview: displayData.overview || '',
                    poster_path: displayData.poster_path || null,
                    backdrop_path: displayData.backdrop_path || null,
                    vote_average: displayData.vote_average || 0,
                    vote_count: 100,
                    popularity: 100,
                    genre_ids: fallbackGenres,
                  };
                openWatchPlayer(itemToPlay);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{mediaType === 'tv' ? 'Watch Series' : 'Watch Movie'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openTrailerModal(
                  details ||
                    initialData || {
                      id: mediaId,
                      media_type: mediaType,
                      title,
                    }
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Film className="w-4 h-4" />
              <span>Play Trailer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const itemToSave: TMDBMediaItem = details ||
                  initialData || {
                    id: mediaId,
                    media_type: mediaType,
                    title,
                    overview: '',
                    poster_path: null,
                    backdrop_path: null,
                    vote_average: 0,
                    vote_count: 0,
                    popularity: 0,
                  };
                toggleWatchlist(itemToSave);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inWatchlist
                  ? 'bg-white text-black border-white hover:bg-zinc-200'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
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
                  <span>Add to My List</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Details Body */}
      <div className="p-6 sm:p-10 space-y-10">
        {error ? (
          <div className="rounded-xl bg-[#16161C] border border-white/10 p-6 text-sm text-zinc-300">
            {error}
          </div>
        ) : (
          <>
            {/* Overview & Key Metadata Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-4">
                <h2 className="text-lg font-bold text-white">Synopsis</h2>
                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                  {displayData.overview ||
                    'No synopsis is currently available for this title on TMDB.'}
                </p>
              </div>

              <div className="lg:col-span-4 space-y-3 text-xs sm:text-sm bg-[#14141A] rounded-xl p-5 border border-white/[0.06]">
                {directors.length > 0 && (
                  <div>
                    <span className="text-zinc-500">Director: </span>
                    <span className="text-zinc-200 font-medium">{directors.join(', ')}</span>
                  </div>
                )}
                {creators.length > 0 && (
                  <div>
                    <span className="text-zinc-500">Created By: </span>
                    <span className="text-zinc-200 font-medium">{creators.join(', ')}</span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">
                    {mediaType === 'tv' ? 'First Air Date: ' : 'Release Date: '}
                  </span>
                  <span className="text-zinc-200 font-mono-tabular">{fullDate}</span>
                </div>
                {details?.status && (
                  <div>
                    <span className="text-zinc-500">Status: </span>
                    <span className="text-zinc-200">{details.status}</span>
                  </div>
                )}
                {details?.production_companies && details.production_companies.length > 0 && (
                  <div>
                    <span className="text-zinc-500">Production: </span>
                    <span className="text-zinc-200">
                      {details.production_companies
                        .slice(0, 4)
                        .map((c) => c.name)
                        .join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Official Trailers & Teasers Section */}
            {videos.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/[0.08]">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Official Trailers &amp; Videos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <button
                      key={video.id || video.key}
                      type="button"
                      onClick={() =>
                        openTrailerModal(
                          { id: mediaId, media_type: mediaType, title },
                          video.key
                        )
                      }
                      className="group text-left rounded-xl overflow-hidden bg-[#14141A] border border-white/[0.08] hover:border-white/25 transition-all cursor-pointer"
                    >
                      <div className="relative aspect-video w-full bg-black overflow-hidden">
                        <img
                          src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
                          alt={video.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 flex items-center justify-center transition-colors">
                          <div className="w-11 h-11 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3.5">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate">
                          {video.name}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                          <span>{video.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {video.size ? `${video.size}p` : 'HD'}
                          </span>
                          {video.official && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-zinc-300">Official</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cast Members Grid */}
            {cast.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/[0.08]">
                <h2 className="text-lg sm:text-xl font-bold text-white">Featured Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {cast.map((member) => {
                    const profileUrl = getProfileUrl(member.profile_path, 'w185');
                    return (
                      <div
                        key={`${member.id}-${member.character}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-[#14141A] border border-white/[0.06]"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                          {profileUrl ? (
                            <img
                              src={profileUrl}
                              alt={member.name}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {member.character || 'Cast'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommended & Similar Titles Section */}
            {(recommendations.length > 0 || similar.length > 0) && (
              <div className="space-y-5 pt-4 border-t border-white/[0.08]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-lg sm:text-xl font-bold text-white">More Like This</h2>

                  {/* Interactive Filter Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-[#16161D] rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => setActiveRelatedTab('recommended')}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeRelatedTab === 'recommended'
                          ? 'bg-[#E50914] text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Recommended ({recommendations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRelatedTab('similar')}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeRelatedTab === 'similar'
                          ? 'bg-[#E50914] text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Similar Titles ({similar.length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {relatedList.slice(0, 6).map((item) => (
                    <MovieCard
                      key={`${item.media_type || mediaType}-${item.id}`}
                      item={{ ...item, media_type: item.media_type || mediaType }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="py-8 flex items-center justify-center gap-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading complete credits &amp; recommendations...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const DetailsModal: React.FC = () => {
  const { activeDetails, closeDetailsModal } = useCineFlix();

  useEffect(() => {
    if (!activeDetails) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDetailsModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDetails, closeDetailsModal]);

  if (!activeDetails) return null;

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-black/80 backdrop-blur-sm p-3 sm:p-6 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-label="Title Details"
      onClick={closeDetailsModal}
    >
      <div
        className="max-w-5xl mx-auto my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <DetailsViewContent
          mediaId={activeDetails.id}
          mediaType={activeDetails.mediaType}
          initialData={activeDetails.initialData}
          onClose={closeDetailsModal}
        />
      </div>
    </div>
  );
};
