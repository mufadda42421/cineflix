import {
  DiscoverParams,
  Genre,
  TMDBCreditsResponse,
  TMDBMediaDetails,
  TMDBMediaItem,
  TMDBPaginatedResponse,
  TMDBVideo,
  TMDBVideosResponse,
} from '../types/tmdb';

export const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

export type TMDBErrorCode =
  | 'MISSING_TOKEN'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'API_ERROR';

export class TMDBApiError extends Error {
  public readonly code: TMDBErrorCode;
  public readonly status?: number;

  constructor(message: string, code: TMDBErrorCode, status?: number) {
    super(message);
    this.name = 'TMDBApiError';
    this.code = code;
    this.status = status;
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const GENRE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const BYOK_STORAGE_KEY = 'cineflix_byok_tmdb_credential';

export function getSavedByokCredential(): string {
  try {
    return (localStorage.getItem(BYOK_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function sanitizeRawCredential(input: string): string {
  return input
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

export function saveByokCredential(rawInput: string): void {
  const cleaned = sanitizeRawCredential(rawInput);
  try {
    if (cleaned) {
      localStorage.setItem(BYOK_STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(BYOK_STORAGE_KEY);
    }
  } catch {
    // Ignore storage error
  }
  clearTMDBCache();
  window.dispatchEvent(new CustomEvent('cineflix-tmdb-key-updated'));
}

export function clearByokCredential(): void {
  try {
    localStorage.removeItem(BYOK_STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
  clearTMDBCache();
  window.dispatchEvent(new CustomEvent('cineflix-tmdb-key-updated'));
}

/**
 * Validates a user-supplied TMDB API Key (v3) or Read Access Token (v4 Bearer)
 * against the live TMDB API before saving.
 */
export async function validateTMDBCredential(rawInput: string): Promise<{
  valid: boolean;
  mode: 'bearer' | 'api_key';
  errorMessage?: string;
}> {
  const cleaned = sanitizeRawCredential(rawInput);
  if (!cleaned) {
    return {
      valid: false,
      mode: 'api_key',
      errorMessage: 'Please enter a TMDB API Key or Read Access Token.',
    };
  }

  const isV3HexKey = /^[a-f0-9]{32}$/i.test(cleaned);
  const url = new URL(`${TMDB_API_BASE_URL}/configuration`);
  const headers: HeadersInit = { Accept: 'application/json' };

  if (isV3HexKey) {
    url.searchParams.set('api_key', cleaned);
  } else {
    headers['Authorization'] = `Bearer ${cleaned}`;
  }

  try {
    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (response.ok) {
      return {
        valid: true,
        mode: isV3HexKey ? 'api_key' : 'bearer',
      };
    }

    // If non-hex failed with Bearer, also test as api_key query param just in case
    if (!isV3HexKey) {
      const fallbackUrl = new URL(`${TMDB_API_BASE_URL}/configuration`);
      fallbackUrl.searchParams.set('api_key', cleaned);
      const fallbackRes = await fetch(fallbackUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (fallbackRes.ok) {
        return { valid: true, mode: 'api_key' };
      }
    }

    let msg = `TMDB returned status ${response.status}. Please check that your key is active.`;
    try {
      const errJson = await response.json();
      if (errJson?.status_message) {
        msg = errJson.status_message;
      }
    } catch {
      // Ignore
    }
    return {
      valid: false,
      mode: isV3HexKey ? 'api_key' : 'bearer',
      errorMessage: msg,
    };
  } catch {
    return {
      valid: false,
      mode: isV3HexKey ? 'api_key' : 'bearer',
      errorMessage: 'Network error while verifying key with api.themoviedb.org.',
    };
  }
}

/**
 * Resolves the configured TMDB credentials from BYOK localStorage first,
 * then falls back to environment variables (VITE_TMDB_ACCESS_TOKEN or VITE_TMDB_API_KEY).
 */
export function getTMDBCredentials(): {
  accessToken: string;
  apiKey: string;
  isConfigured: boolean;
  source: 'byok' | 'env' | 'none';
} {
  const byok = sanitizeRawCredential(getSavedByokCredential());
  if (byok) {
    // JWT / v4 Read Access Tokens start with eyJ or are > 40 chars
    if (/^[a-f0-9]{32}$/i.test(byok) || (!byok.startsWith('eyJ') && byok.length <= 40)) {
      return {
        accessToken: '',
        apiKey: byok,
        isConfigured: true,
        source: 'byok',
      };
    }
    return {
      accessToken: byok,
      apiKey: '',
      isConfigured: true,
      source: 'byok',
    };
  }

  const rawToken = sanitizeRawCredential(import.meta.env.VITE_TMDB_ACCESS_TOKEN || '');
  const rawKey = sanitizeRawCredential(import.meta.env.VITE_TMDB_API_KEY || '');

  const isPlaceholder = (val: string) =>
    !val ||
    val === 'MY_TMDB_ACCESS_TOKEN' ||
    val === 'YOUR_TMDB_ACCESS_TOKEN' ||
    val === 'MY_TMDB_API_KEY' ||
    val === 'YOUR_TMDB_API_KEY';

  let accessToken = isPlaceholder(rawToken) ? '' : rawToken;
  let apiKey = isPlaceholder(rawKey) ? '' : rawKey;

  if (accessToken && /^[a-f0-9]{32}$/i.test(accessToken) && !apiKey) {
    apiKey = accessToken;
    accessToken = '';
  }

  const isConfigured = Boolean(accessToken || apiKey);

  return {
    accessToken,
    apiKey,
    isConfigured,
    source: isConfigured ? 'env' : 'none',
  };
}

export function clearTMDBCache(): void {
  responseCache.clear();
  inFlightRequests.clear();
}

/**
 * Image URL helpers following TMDB official specifications:
 * https://image.tmdb.org/t/p/
 * Uses w500 for posters and original for backdrops.
 */
export function getPosterUrl(
  posterPath: string | null | undefined,
  size: 'w342' | 'w500' | 'w780' = 'w500'
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE_URL}${size}${posterPath}`;
}

export function getBackdropUrl(
  backdropPath: string | null | undefined,
  size: 'w1280' | 'original' = 'original'
): string | null {
  if (!backdropPath) return null;
  return `${TMDB_IMAGE_BASE_URL}${size}${backdropPath}`;
}

export function getProfileUrl(
  profilePath: string | null | undefined,
  size: 'w185' | 'h632' = 'w185'
): string | null {
  if (!profilePath) return null;
  return `${TMDB_IMAGE_BASE_URL}${size}${profilePath}`;
}

export function getDisplayTitle(item: Partial<TMDBMediaItem>): string {
  return item.title || item.name || item.original_title || item.original_name || 'Untitled';
}

export function getReleaseYear(item: Partial<TMDBMediaItem>): string {
  const dateStr = item.release_date || item.first_air_date;
  if (!dateStr) return 'TBA';
  const year = dateStr.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : 'TBA';
}

export function inferMediaType(
  item: Partial<TMDBMediaItem>,
  fallback: 'movie' | 'tv' = 'movie'
): 'movie' | 'tv' {
  if (item.media_type === 'movie' || item.media_type === 'tv') {
    return item.media_type;
  }
  if (item.first_air_date && !item.release_date) return 'tv';
  if (item.name && !item.title) return 'tv';
  return fallback;
}

/**
 * Core HTTP client for TMDB API with Bearer authorization, caching, deduplication,
 * and structured error classification.
 */
async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  signal?: AbortSignal
): Promise<T> {
  const { accessToken, apiKey, isConfigured } = getTMDBCredentials();

  if (!isConfigured) {
    throw new TMDBApiError(
      'TMDB API credentials are not configured. Set VITE_TMDB_ACCESS_TOKEN in your environment variables or Secrets panel.',
      'MISSING_TOKEN'
    );
  }

  const url = new URL(`${TMDB_API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  if (!accessToken && apiKey) {
    url.searchParams.set('api_key', apiKey);
  }

  const cacheKey = url.toString();
  const now = Date.now();

  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  // Deduplicate concurrent identical requests if no custom AbortSignal is provided
  if (!signal && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const headers: HeadersInit = {
    Accept: 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const requestPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new TMDBApiError(
        'Network error while connecting to TMDB API. Please verify your internet connection.',
        'NETWORK_ERROR'
      );
    }

    if (!response.ok) {
      let apiMessage = `TMDB API request failed with status ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.status_message) {
          apiMessage = errBody.status_message;
        }
      } catch {
        // Ignore JSON parse failure
      }

      if (response.status === 401) {
        throw new TMDBApiError(
          `Invalid TMDB Access Token: ${apiMessage}`,
          'UNAUTHORIZED',
          401
        );
      }
      if (response.status === 429) {
        throw new TMDBApiError(
          'TMDB API rate limit exceeded. Please wait a moment and try again.',
          'RATE_LIMITED',
          429
        );
      }
      if (response.status === 404) {
        throw new TMDBApiError(
          'The requested movie or TV series could not be found on TMDB.',
          'NOT_FOUND',
          404
        );
      }
      throw new TMDBApiError(apiMessage, 'API_ERROR', response.status);
    }

    const data = (await response.json()) as T;
    responseCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
    return data;
  })();

  if (!signal) {
    inFlightRequests.set(cacheKey, requestPromise);
    requestPromise.finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  }

  return requestPromise;
}

// ============================================================================
// 1. TRENDING & CORE CATALOG ENDPOINTS
// ============================================================================

/** Trending: /trending/all/day */
export async function getTrendingAllDay(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/trending/all/day', {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.filter((item) => item.media_type !== 'person'),
  };
}

/** Popular movies: /movie/popular */
export async function getPopularMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/movie/popular', {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'movie' })),
  };
}

/** Top-rated movies: /movie/top_rated */
export async function getTopRatedMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/movie/top_rated', {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'movie' })),
  };
}

/** Upcoming movies: /movie/upcoming */
export async function getUpcomingMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/movie/upcoming', {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'movie' })),
  };
}

/** Popular TV: /tv/popular */
export async function getPopularTV(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/tv/popular', {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'tv' })),
  };
}

/** Top-rated TV: /tv/top_rated */
export async function getTopRatedTV(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/tv/top_rated', {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'tv' })),
  };
}

// ============================================================================
// 2. DETAILS, CREDITS, VIDEOS, SIMILAR & RECOMMENDATIONS
// ============================================================================

/** Movie details: /movie/{movie_id} */
export async function getMovieDetails(movieId: number): Promise<TMDBMediaDetails> {
  const res = await tmdbFetch<TMDBMediaDetails>(`/movie/${movieId}`, {
    language: 'en-US',
  });
  return { ...res, media_type: 'movie' };
}

/** TV details: /tv/{series_id} */
export async function getTVDetails(seriesId: number): Promise<TMDBMediaDetails> {
  const res = await tmdbFetch<TMDBMediaDetails>(`/tv/${seriesId}`, {
    language: 'en-US',
  });
  return { ...res, media_type: 'tv' };
}

export interface TMDBEpisodeSummary {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime?: number;
  air_date?: string;
}

export interface TMDBSeasonDetailsResponse {
  id: number;
  season_number: number;
  name: string;
  episodes: TMDBEpisodeSummary[];
}

/** TV season details: /tv/{series_id}/season/{season_number} */
export async function getTVSeasonDetails(
  seriesId: number,
  seasonNumber: number
): Promise<TMDBSeasonDetailsResponse> {
  return tmdbFetch<TMDBSeasonDetailsResponse>(
    `/tv/${seriesId}/season/${seasonNumber}`,
    { language: 'en-US' }
  );
}

/** Unified details helper */
export async function getMediaDetails(
  mediaType: 'movie' | 'tv',
  id: number
): Promise<TMDBMediaDetails> {
  return mediaType === 'movie' ? getMovieDetails(id) : getTVDetails(id);
}

/** Movie credits: /movie/{movie_id}/credits */
export async function getMovieCredits(movieId: number): Promise<TMDBCreditsResponse> {
  return tmdbFetch<TMDBCreditsResponse>(`/movie/${movieId}/credits`, {
    language: 'en-US',
  });
}

/** TV credits: /tv/{series_id}/credits */
export async function getTVCredits(seriesId: number): Promise<TMDBCreditsResponse> {
  return tmdbFetch<TMDBCreditsResponse>(`/tv/${seriesId}/credits`, {
    language: 'en-US',
  });
}

/** Unified credits helper */
export async function getMediaCredits(
  mediaType: 'movie' | 'tv',
  id: number
): Promise<TMDBCreditsResponse> {
  return mediaType === 'movie' ? getMovieCredits(id) : getTVCredits(id);
}

/** Movie videos: /movie/{movie_id}/videos */
export async function getMovieVideos(movieId: number): Promise<TMDBVideosResponse> {
  return tmdbFetch<TMDBVideosResponse>(`/movie/${movieId}/videos`, {
    language: 'en-US',
  });
}

/** TV videos: /tv/{series_id}/videos */
export async function getTVVideos(seriesId: number): Promise<TMDBVideosResponse> {
  return tmdbFetch<TMDBVideosResponse>(`/tv/${seriesId}/videos`, {
    language: 'en-US',
  });
}

/** Unified videos helper */
export async function getMediaVideos(
  mediaType: 'movie' | 'tv',
  id: number
): Promise<TMDBVideosResponse> {
  return mediaType === 'movie' ? getMovieVideos(id) : getTVVideos(id);
}

/** Similar titles: /movie/{movie_id}/similar or /tv/{series_id}/similar */
export async function getSimilarTitles(
  mediaType: 'movie' | 'tv',
  id: number,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const endpoint = mediaType === 'movie' ? `/movie/${id}/similar` : `/tv/${id}/similar`;
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>(endpoint, {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: mediaType })),
  };
}

/** Recommendations: /movie/{movie_id}/recommendations or /tv/{series_id}/recommendations */
export async function getRecommendations(
  mediaType: 'movie' | 'tv',
  id: number,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const endpoint =
    mediaType === 'movie' ? `/movie/${id}/recommendations` : `/tv/${id}/recommendations`;
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>(endpoint, {
    language: 'en-US',
    page,
  });
  return {
    ...res,
    results: res.results.map((item) => ({
      ...item,
      media_type: item.media_type || mediaType,
    })),
  };
}

// ============================================================================
// 3. GENRES, DISCOVER & MULTI-SEARCH ENDPOINTS
// ============================================================================

/** Movie genres: /genre/movie/list */
export async function getMovieGenres(): Promise<Genre[]> {
  const res = await tmdbFetch<{ genres: Genre[] }>(
    '/genre/movie/list',
    { language: 'en-US' },
    GENRE_CACHE_TTL_MS
  );
  return res.genres || [];
}

/** TV genres: /genre/tv/list */
export async function getTVGenres(): Promise<Genre[]> {
  const res = await tmdbFetch<{ genres: Genre[] }>(
    '/genre/tv/list',
    { language: 'en-US' },
    GENRE_CACHE_TTL_MS
  );
  return res.genres || [];
}

/** Discover movies: /discover/movie */
export async function discoverMovies(
  params: DiscoverParams = {}
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/discover/movie', {
    language: 'en-US',
    include_adult: false,
    include_video: false,
    page: params.page || 1,
    sort_by: params.sort_by || 'popularity.desc',
    with_genres: params.with_genres,
    'vote_count.gte': params['vote_count.gte'] ?? (params.sort_by === 'vote_average.desc' ? 200 : 25),
    primary_release_year: params.primary_release_year,
    with_original_language: params.with_original_language,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'movie' })),
  };
}

/** Discover TV: /discover/tv */
export async function discoverTV(
  params: DiscoverParams = {}
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>('/discover/tv', {
    language: 'en-US',
    include_adult: false,
    page: params.page || 1,
    sort_by: params.sort_by || 'popularity.desc',
    with_genres: params.with_genres,
    'vote_count.gte': params['vote_count.gte'] ?? (params.sort_by === 'vote_average.desc' ? 150 : 20),
    first_air_date_year: params.first_air_date_year,
    with_original_language: params.with_original_language,
  });
  return {
    ...res,
    results: res.results.map((item) => ({ ...item, media_type: 'tv' })),
  };
}

/** Multi-search: /search/multi */
export async function searchMulti(
  query: string,
  page = 1,
  signal?: AbortSignal
): Promise<TMDBPaginatedResponse<TMDBMediaItem>> {
  return tmdbFetch<TMDBPaginatedResponse<TMDBMediaItem>>(
    '/search/multi',
    {
      query: query.trim(),
      include_adult: false,
      language: 'en-US',
      page,
    },
    DEFAULT_CACHE_TTL_MS,
    signal
  );
}

// ============================================================================
// 4. HIGH-DEFINITION TRAILER SELECTION & GENRE-PERSONALIZED RANKING
// ============================================================================

/**
 * Scores and sorts videos to prioritize official High-Definition (4K/1080p) YouTube trailers.
 */
export function scoreTrailerVideo(video: TMDBVideo): number {
  if (video.site !== 'YouTube' || !video.key) return -1;

  let score = 0;

  // 1. Official status weight
  if (video.official) score += 60;

  // 2. Content type priority
  if (video.type === 'Trailer') score += 50;
  else if (video.type === 'Teaser') score += 25;
  else if (video.type === 'Clip') score += 12;
  else if (video.type === 'Featurette') score += 8;

  // 3. High-Definition resolution priority (4K / 1080p / 720p)
  const resolution = Number(video.size) || 0;
  if (resolution >= 2160) score += 45;
  else if (resolution >= 1080) score += 35;
  else if (resolution >= 720) score += 20;
  else if (resolution >= 480) score += 5;

  // 4. Title keywords indicating main/official trailer
  const lowerName = (video.name || '').toLowerCase();
  if (lowerName.includes('official trailer')) score += 25;
  else if (lowerName.includes('main trailer')) score += 20;
  else if (lowerName.includes('final trailer')) score += 18;
  else if (lowerName.includes('trailer')) score += 10;

  return score;
}

export function sortVideosByHDQuality(videos: TMDBVideo[]): TMDBVideo[] {
  return [...videos]
    .filter((v) => v.site === 'YouTube' && Boolean(v.key))
    .sort((a, b) => scoreTrailerVideo(b) - scoreTrailerVideo(a));
}

export function selectBestTrailer(videos: TMDBVideo[]): TMDBVideo | null {
  const sorted = sortVideosByHDQuality(videos);
  return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Ranks search and discovery results by combining TMDB popularity/rating quality
 * with the user's personalized genre affinity scores.
 */
export function rankResultsByGenreAffinity(
  items: TMDBMediaItem[],
  genreAffinityMap: Record<number, number>
): TMDBMediaItem[] {
  const hasAffinity = Object.keys(genreAffinityMap).length > 0;

  return [...items].sort((a, b) => {
    const scoreItem = (item: TMDBMediaItem): number => {
      if (item.media_type === 'person') {
        return (item.popularity || 0) * 0.5;
      }

      let score = 0;
      // Base quality & popularity
      score += Math.min(item.popularity || 0, 500) * 0.15;
      score += (item.vote_average || 0) * 8;
      if (item.backdrop_path) score += 15; // High-definition visual availability
      if (item.poster_path) score += 15;

      // Personalized genre boost
      if (hasAffinity && item.genre_ids && item.genre_ids.length > 0) {
        let genreBoost = 0;
        for (const gid of item.genre_ids) {
          if (genreAffinityMap[gid]) {
            genreBoost += genreAffinityMap[gid] * 12;
          }
        }
        score += Math.min(genreBoost, 80);
      }

      return score;
    };

    return scoreItem(b) - scoreItem(a);
  });
}
