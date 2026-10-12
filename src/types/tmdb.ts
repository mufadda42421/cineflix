export type MediaType = 'movie' | 'tv' | 'person';

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TMDBMediaItem {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: Genre[];
  adult?: boolean;
  original_language?: string;
  known_for_department?: string;
  known_for?: TMDBMediaItem[];
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface CreatedBy {
  id: number;
  credit_id: string;
  name: string;
  profile_path: string | null;
}

export interface TMDBMediaDetails extends TMDBMediaItem {
  media_type: 'movie' | 'tv';
  genres: Genre[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  status: string;
  tagline?: string;
  homepage?: string;
  budget?: number;
  revenue?: number;
  production_companies: ProductionCompany[];
  created_by?: CreatedBy[];
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
}

export interface CastMember {
  id: number;
  name: string;
  original_name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department?: string;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCreditsResponse {
  id: number;
  cast: CastMember[];
  crew: CrewMember[];
}

export interface TMDBVideo {
  id: string;
  iso_639_1: string;
  iso_3166_1: string;
  key: string;
  name: string;
  site: string;
  size: number; // e.g., 360, 480, 720, 1080, 2160
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | 'Behind the Scenes' | 'Bloopers' | string;
  official: boolean;
  published_at: string;
}

export interface TMDBVideosResponse {
  id: number;
  results: TMDBVideo[];
}

export interface DiscoverParams {
  page?: number;
  with_genres?: string;
  sort_by?:
    | 'popularity.desc'
    | 'popularity.asc'
    | 'vote_average.desc'
    | 'vote_average.asc'
    | 'primary_release_date.desc'
    | 'primary_release_date.asc'
    | 'first_air_date.desc'
    | 'first_air_date.asc';
  'vote_count.gte'?: number;
  primary_release_year?: number;
  first_air_date_year?: number;
  with_original_language?: string;
}

export interface WatchlistItem {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  addedAt: number;
}

export interface ViewingHistoryEntry {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  progressSeconds: number;
  durationSeconds: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: number;
}

export interface UserProfileData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio: string;
  favoriteGenres: number[];
  autoplayTrailers: boolean;
}
