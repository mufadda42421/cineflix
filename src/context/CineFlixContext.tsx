import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseAuthProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  sanitizeBoundedGenreIds,
  sanitizeDocId,
  sanitizeString,
} from '../lib/firebase';
import {
  getDisplayTitle,
  getMovieGenres,
  getTMDBCredentials,
  getTVGenres,
  inferMediaType,
} from '../services/tmdb';
import {
  Genre,
  TMDBMediaItem,
  UserProfileData,
  ViewingHistoryEntry,
  WatchlistItem,
} from '../types/tmdb';

const WATCHLIST_STORAGE_KEY = 'cineflix_watchlist_v1';
const HISTORY_STORAGE_KEY = 'cineflix_watch_history_v1';
const AFFINITY_STORAGE_KEY = 'cineflix_genre_affinity_v1';

const DEFAULT_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

interface ActiveModalMedia {
  id: number;
  mediaType: 'movie' | 'tv';
  initialData?: TMDBMediaItem;
}

interface ActiveTrailerMedia {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  videoKey?: string;
}

export interface ActiveWatchPlayerMedia {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  item: TMDBMediaItem;
  initialSeason?: number;
  initialEpisode?: number;
}

interface CineFlixContextValue {
  // Authentication & User Profile
  user: User | null;
  userProfile: UserProfileData | null;
  isAuthReady: boolean;
  authLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (updates: {
    displayName: string;
    bio: string;
    photoURL: string;
    favoriteGenres: number[];
    autoplayTrailers: boolean;
  }) => Promise<void>;
  profileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  byokModalOpen: boolean;
  openByokModal: () => void;
  closeByokModal: () => void;

  // Watchlist (Cross-device Firestore synced when logged in)
  watchlist: WatchlistItem[];
  addToWatchlist: (item: TMDBMediaItem) => Promise<void>;
  removeFromWatchlist: (id: number, mediaType: 'movie' | 'tv') => Promise<void>;
  toggleWatchlist: (item: TMDBMediaItem) => Promise<void>;
  isInWatchlist: (id: number, mediaType?: 'movie' | 'tv') => boolean;

  // Viewing History & Personalized Recommendations
  viewingHistory: ViewingHistoryEntry[];
  recordWatchProgress: (
    item: TMDBMediaItem,
    progressSeconds?: number,
    durationSeconds?: number,
    seasonNumber?: number,
    episodeNumber?: number
  ) => Promise<void>;
  removeFromHistory: (id: number, mediaType: 'movie' | 'tv') => Promise<void>;
  genreMap: Record<number, string>;
  movieGenres: Genre[];
  tvGenres: Genre[];
  genreAffinity: Record<number, number>;
  recordGenreInteraction: (genreIds?: number[], weight?: number) => void;
  getTopAffinityGenres: (limit?: number) => number[];

  // Modals (Details, Trailer, Full Feature Player)
  activeDetails: ActiveModalMedia | null;
  openDetailsModal: (item: TMDBMediaItem | { id: number; media_type: 'movie' | 'tv' }) => void;
  closeDetailsModal: () => void;
  activeTrailer: ActiveTrailerMedia | null;
  openTrailerModal: (
    item: TMDBMediaItem | { id: number; media_type: 'movie' | 'tv'; title?: string },
    specificVideoKey?: string
  ) => void;
  closeTrailerModal: () => void;
  activeWatchPlayer: ActiveWatchPlayerMedia | null;
  openWatchPlayer: (
    item: TMDBMediaItem,
    seasonNumber?: number,
    episodeNumber?: number
  ) => void;
  closeWatchPlayer: () => void;
}

const CineFlixContext = createContext<CineFlixContextValue | undefined>(undefined);

export const CineFlixProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [byokModalOpen, setByokModalOpen] = useState(false);
  const [profileDocReady, setProfileDocReady] = useState(false);

  // Local Watchlist & Cloud Watchlist
  const [localWatchlist, setLocalWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [cloudWatchlist, setCloudWatchlist] = useState<WatchlistItem[]>([]);

  // Local Viewing History & Cloud Viewing History
  const [localHistory, setLocalHistory] = useState<ViewingHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [cloudHistory, setCloudHistory] = useState<ViewingHistoryEntry[]>([]);

  const [genreAffinity, setGenreAffinity] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(AFFINITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // Ignore
    }
    return { 28: 3, 878: 3, 18: 2 };
  });

  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTvGenres] = useState<Genre[]>([]);
  const [genreMap, setGenreMap] = useState<Record<number, string>>(DEFAULT_GENRE_MAP);

  const [activeDetails, setActiveDetails] = useState<ActiveModalMedia | null>(null);
  const [activeTrailer, setActiveTrailer] = useState<ActiveTrailerMedia | null>(null);
  const [activeWatchPlayer, setActiveWatchPlayer] = useState<ActiveWatchPlayerMedia | null>(
    null
  );

  const localWatchlistRef = useRef(localWatchlist);
  localWatchlistRef.current = localWatchlist;

  // Persist local guest states
  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(localWatchlist));
    } catch {
      // Ignore
    }
  }, [localWatchlist]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(localHistory));
    } catch {
      // Ignore
    }
  }, [localHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(AFFINITY_STORAGE_KEY, JSON.stringify(genreAffinity));
    } catch {
      // Ignore
    }
  }, [genreAffinity]);

  // Fetch official TMDB genre maps
  const loadGenreMaps = useCallback(() => {
    const { isConfigured } = getTMDBCredentials();
    if (!isConfigured) return;

    Promise.allSettled([getMovieGenres(), getTVGenres()]).then(([mRes, tRes]) => {
      const merged: Record<number, string> = { ...DEFAULT_GENRE_MAP };
      if (mRes.status === 'fulfilled') {
        setMovieGenres(mRes.value);
        mRes.value.forEach((g) => {
          merged[g.id] = g.name;
        });
      }
      if (tRes.status === 'fulfilled') {
        setTvGenres(tRes.value);
        tRes.value.forEach((g) => {
          merged[g.id] = g.name;
        });
      }
      setGenreMap(merged);
    });
  }, []);

  useEffect(() => {
    loadGenreMaps();
    const handleKeyUpdate = () => {
      loadGenreMaps();
    };
    window.addEventListener('cineflix-tmdb-key-updated', handleKeyUpdate);
    return () => {
      window.removeEventListener('cineflix-tmdb-key-updated', handleKeyUpdate);
    };
  }, [loadGenreMaps]);

  // Track Firebase Auth state & ensure parent /users/{uid} document exists
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setProfileDocReady(false);

      if (!firebaseUser) {
        setUserProfile(null);
        setCloudWatchlist([]);
        setCloudHistory([]);
        setIsAuthReady(true);
        return;
      }

      const userPath = `users/${firebaseUser.uid}`;
      const userRef = doc(db, 'users', firebaseUser.uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialPayload = {
            uid: sanitizeString(firebaseUser.uid, 128, 'user'),
            displayName: sanitizeString(
              firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'CineFlix Member',
              80,
              'CineFlix Member'
            ),
            email: sanitizeString(firebaseUser.email || 'member@cineflix.app', 160, 'member@cineflix.app'),
            photoURL: sanitizeString(firebaseUser.photoURL || '', 500, ''),
            bio: 'Cinema & television enthusiast on CineFlix.',
            favoriteGenres: [28, 878, 18],
            autoplayTrailers: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, initialPayload);
        }

        // Migrate any local guest watchlist items to the user's cloud watchlist
        const guestItems = localWatchlistRef.current;
        if (guestItems.length > 0) {
          for (const item of guestItems.slice(0, 25)) {
            const docId = sanitizeDocId(`${item.media_type}_${item.id}`);
            const itemRef = doc(db, 'users', firebaseUser.uid, 'watchlist', docId);
            const existingItem = await getDoc(itemRef);
            if (!existingItem.exists()) {
              await setDoc(itemRef, {
                userId: firebaseUser.uid,
                tmdbId: Math.max(1, Math.trunc(Number(item.id))),
                mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
                title: sanitizeString(item.title, 200, 'Untitled'),
                overview: sanitizeString(item.overview, 1000, ''),
                posterPath: sanitizeString(item.poster_path || '', 200, ''),
                backdropPath: sanitizeString(item.backdrop_path || '', 200, ''),
                releaseDate: sanitizeString(item.release_date || '', 30, ''),
                voteAverage: Math.min(10, Math.max(0, Number(item.vote_average) || 0)),
                genreIds: sanitizeBoundedGenreIds(item.genre_ids),
                createdAt: serverTimestamp(),
              });
            }
          }
        }

        setProfileDocReady(true);
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        } catch {
          // Logged via handleFirestoreError
        }
      } finally {
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners once user is authenticated and parent profile exists
  useEffect(() => {
    if (!isAuthReady || !user || !profileDocReady) return;

    const uid = user.uid;
    const profilePath = `users/${uid}`;
    const watchlistPath = `users/${uid}/watchlist`;
    const historyPath = `users/${uid}/history`;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setUserProfile({
            uid: d.uid,
            displayName: d.displayName || 'CineFlix Member',
            email: d.email || user.email || '',
            photoURL: d.photoURL || '',
            bio: d.bio || '',
            favoriteGenres: Array.isArray(d.favoriteGenres) ? d.favoriteGenres : [],
            autoplayTrailers: Boolean(d.autoplayTrailers ?? true),
          });
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, profilePath);
        } catch {
          // Handled
        }
      }
    );

    const watchlistQuery = query(
      collection(db, 'users', uid, 'watchlist'),
      where('userId', '==', uid)
    );
    const unsubWatchlist = onSnapshot(
      watchlistQuery,
      (snap) => {
        const items: WatchlistItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdMs =
            d.createdAt && typeof d.createdAt.toMillis === 'function'
              ? d.createdAt.toMillis()
              : Date.now();
          return {
            id: Number(d.tmdbId),
            media_type: d.mediaType === 'tv' ? 'tv' : 'movie',
            title: d.title || 'Untitled',
            overview: d.overview || '',
            poster_path: d.posterPath || null,
            backdrop_path: d.backdropPath || null,
            release_date: d.releaseDate || '',
            vote_average: Number(d.voteAverage) || 0,
            genre_ids: Array.isArray(d.genreIds) ? d.genreIds : [],
            addedAt: createdMs,
          };
        });
        items.sort((a, b) => b.addedAt - a.addedAt);
        setCloudWatchlist(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, watchlistPath);
        } catch {
          // Handled
        }
      }
    );

    const historyQuery = query(
      collection(db, 'users', uid, 'history'),
      where('userId', '==', uid)
    );
    const unsubHistory = onSnapshot(
      historyQuery,
      (snap) => {
        const entries: ViewingHistoryEntry[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const updatedMs =
            d.updatedAt && typeof d.updatedAt.toMillis === 'function'
              ? d.updatedAt.toMillis()
              : Date.now();
          return {
            id: Number(d.tmdbId),
            media_type: d.mediaType === 'tv' ? 'tv' : 'movie',
            title: d.title || 'Untitled',
            overview: d.overview || '',
            poster_path: d.posterPath || null,
            backdrop_path: d.backdropPath || null,
            release_date: d.releaseDate || '',
            vote_average: Number(d.voteAverage) || 0,
            genre_ids: Array.isArray(d.genreIds) ? d.genreIds : [],
            progressSeconds: Number(d.progressSeconds) || 0,
            durationSeconds: Number(d.durationSeconds) || 0,
            seasonNumber: Number(d.seasonNumber) || 1,
            episodeNumber: Number(d.episodeNumber) || 1,
            watchedAt: updatedMs,
          };
        });
        entries.sort((a, b) => b.watchedAt - a.watchedAt);
        setCloudHistory(entries);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, historyPath);
        } catch {
          // Handled
        }
      }
    );

    return () => {
      unsubProfile();
      unsubWatchlist();
      unsubHistory();
    };
  }, [isAuthReady, user, profileDocReady]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to sign in with Google. Please try again.';
      setAuthError(msg);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setProfileModalOpen(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign out failed.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const updateUserProfile = useCallback(
    async (updates: {
      displayName: string;
      bio: string;
      photoURL: string;
      favoriteGenres: number[];
      autoplayTrailers: boolean;
    }) => {
      if (!user) return;
      const path = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);

      const cleanDisplayName = sanitizeString(updates.displayName, 80, 'CineFlix Member');
      const cleanPhotoURL = sanitizeString(updates.photoURL, 500, '');
      const cleanBio = sanitizeString(updates.bio, 240, '');
      const cleanGenres = sanitizeBoundedGenreIds(updates.favoriteGenres);

      try {
        await updateDoc(userRef, {
          displayName: cleanDisplayName,
          photoURL: cleanPhotoURL,
          bio: cleanBio,
          favoriteGenres: cleanGenres,
          autoplayTrailers: Boolean(updates.autoplayTrailers),
          updatedAt: serverTimestamp(),
        });

        await updateFirebaseAuthProfile(user, {
          displayName: cleanDisplayName,
          photoURL: cleanPhotoURL || null,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  // Effective watchlist & viewing history (cloud when signed in, local when guest)
  const watchlist = user ? cloudWatchlist : localWatchlist;
  const viewingHistory = user ? cloudHistory : localHistory;

  const recordGenreInteraction = useCallback((genreIds?: number[], weight = 1) => {
    if (!genreIds || genreIds.length === 0) return;
    setGenreAffinity((prev) => {
      const next = { ...prev };
      for (const id of genreIds) {
        if (id > 0) {
          next[id] = (next[id] || 0) + weight;
        }
      }
      return next;
    });
  }, []);

  // Combine explicit profile favoriteGenres + viewing history genres + watchlist genres + interaction weights
  const combinedGenreAffinity = useMemo(() => {
    const merged: Record<number, number> = { ...genreAffinity };
    if (userProfile?.favoriteGenres) {
      for (const gid of userProfile.favoriteGenres) {
        merged[gid] = (merged[gid] || 0) + 8;
      }
    }
    for (const h of viewingHistory.slice(0, 15)) {
      for (const gid of h.genre_ids || []) {
        merged[gid] = (merged[gid] || 0) + 4;
      }
    }
    for (const w of watchlist.slice(0, 15)) {
      for (const gid of w.genre_ids || []) {
        merged[gid] = (merged[gid] || 0) + 3;
      }
    }
    return merged;
  }, [genreAffinity, userProfile, viewingHistory, watchlist]);

  const getTopAffinityGenres = useCallback(
    (limit = 3): number[] => {
      const entries = Object.entries(combinedGenreAffinity)
        .map(([id, score]) => ({ id: Number(id), score }))
        .filter((e) => e.id > 0)
        .sort((a, b) => b.score - a.score);
      return entries.slice(0, limit).map((e) => e.id);
    },
    [combinedGenreAffinity]
  );

  const isInWatchlist = useCallback(
    (id: number, mediaType?: 'movie' | 'tv') => {
      return watchlist.some(
        (item) => item.id === id && (!mediaType || item.media_type === mediaType)
      );
    },
    [watchlist]
  );

  const addToWatchlist = useCallback(
    async (item: TMDBMediaItem) => {
      const mediaType = inferMediaType(item);
      const genreIds = sanitizeBoundedGenreIds(
        item.genre_ids || (item.genres ? item.genres.map((g) => g.id) : [])
      );
      recordGenreInteraction(genreIds, 3);

      const entry: WatchlistItem = {
        id: item.id,
        media_type: mediaType,
        title: getDisplayTitle(item),
        overview: item.overview || '',
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date || item.first_air_date || '',
        vote_average: item.vote_average || 0,
        genre_ids: genreIds,
        addedAt: Date.now(),
      };

      if (user) {
        const docId = sanitizeDocId(`${mediaType}_${item.id}`);
        const itemPath = `users/${user.uid}/watchlist/${docId}`;
        const itemRef = doc(db, 'users', user.uid, 'watchlist', docId);
        try {
          await setDoc(itemRef, {
            userId: user.uid,
            tmdbId: Math.max(1, Math.trunc(Number(item.id))),
            mediaType,
            title: sanitizeString(entry.title, 200, 'Untitled'),
            overview: sanitizeString(entry.overview, 1000, ''),
            posterPath: sanitizeString(entry.poster_path || '', 200, ''),
            backdropPath: sanitizeString(entry.backdrop_path || '', 200, ''),
            releaseDate: sanitizeString(entry.release_date, 30, ''),
            voteAverage: Math.min(10, Math.max(0, Number(entry.vote_average) || 0)),
            genreIds,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, itemPath);
        }
      } else {
        setLocalWatchlist((prev) => {
          if (
            prev.some(
              (existing) => existing.id === item.id && existing.media_type === mediaType
            )
          ) {
            return prev;
          }
          return [entry, ...prev];
        });
      }
    },
    [recordGenreInteraction, user]
  );

  const removeFromWatchlist = useCallback(
    async (id: number, mediaType: 'movie' | 'tv') => {
      if (user) {
        const docId = sanitizeDocId(`${mediaType}_${id}`);
        const itemPath = `users/${user.uid}/watchlist/${docId}`;
        const itemRef = doc(db, 'users', user.uid, 'watchlist', docId);
        try {
          await deleteDoc(itemRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, itemPath);
        }
      } else {
        setLocalWatchlist((prev) =>
          prev.filter((item) => !(item.id === id && item.media_type === mediaType))
        );
      }
    },
    [user]
  );

  const toggleWatchlist = useCallback(
    async (item: TMDBMediaItem) => {
      const mediaType = inferMediaType(item);
      if (isInWatchlist(item.id, mediaType)) {
        await removeFromWatchlist(item.id, mediaType);
      } else {
        await addToWatchlist(item);
      }
    },
    [addToWatchlist, isInWatchlist, removeFromWatchlist]
  );

  const recordWatchProgress = useCallback(
    async (
      item: TMDBMediaItem,
      progressSeconds = 0,
      durationSeconds = 7200,
      seasonNumber = 1,
      episodeNumber = 1
    ) => {
      const mediaType = inferMediaType(item);
      const genreIds = sanitizeBoundedGenreIds(
        item.genre_ids || (item.genres ? item.genres.map((g) => g.id) : [])
      );
      recordGenreInteraction(genreIds, 4);

      const cleanProgress = Math.min(86400, Math.max(0, Math.trunc(progressSeconds)));
      const cleanDuration = Math.min(86400, Math.max(60, Math.trunc(durationSeconds)));
      const cleanSeason = Math.min(100, Math.max(1, Math.trunc(seasonNumber)));
      const cleanEpisode = Math.min(2000, Math.max(1, Math.trunc(episodeNumber)));

      const entry: ViewingHistoryEntry = {
        id: item.id,
        media_type: mediaType,
        title: getDisplayTitle(item),
        overview: item.overview || '',
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date || item.first_air_date || '',
        vote_average: item.vote_average || 0,
        genre_ids: genreIds,
        progressSeconds: cleanProgress,
        durationSeconds: cleanDuration,
        seasonNumber: cleanSeason,
        episodeNumber: cleanEpisode,
        watchedAt: Date.now(),
      };

      // Always update local history for instant responsiveness
      setLocalHistory((prev) => {
        const filtered = prev.filter(
          (existing) => !(existing.id === item.id && existing.media_type === mediaType)
        );
        return [entry, ...filtered].slice(0, 30);
      });

      if (user) {
        const docId = sanitizeDocId(`${mediaType}_${item.id}`);
        const itemPath = `users/${user.uid}/history/${docId}`;
        const itemRef = doc(db, 'users', user.uid, 'history', docId);
        try {
          const existingSnap = await getDoc(itemRef);
          if (existingSnap.exists()) {
            await updateDoc(itemRef, {
              title: sanitizeString(entry.title, 200, 'Untitled'),
              overview: sanitizeString(entry.overview, 1000, ''),
              posterPath: sanitizeString(entry.poster_path || '', 200, ''),
              backdropPath: sanitizeString(entry.backdrop_path || '', 200, ''),
              releaseDate: sanitizeString(entry.release_date, 30, ''),
              voteAverage: Math.min(10, Math.max(0, Number(entry.vote_average) || 0)),
              genreIds,
              progressSeconds: cleanProgress,
              durationSeconds: cleanDuration,
              seasonNumber: cleanSeason,
              episodeNumber: cleanEpisode,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(itemRef, {
              userId: user.uid,
              tmdbId: Math.max(1, Math.trunc(Number(item.id))),
              mediaType,
              title: sanitizeString(entry.title, 200, 'Untitled'),
              overview: sanitizeString(entry.overview, 1000, ''),
              posterPath: sanitizeString(entry.poster_path || '', 200, ''),
              backdropPath: sanitizeString(entry.backdrop_path || '', 200, ''),
              releaseDate: sanitizeString(entry.release_date, 30, ''),
              voteAverage: Math.min(10, Math.max(0, Number(entry.vote_average) || 0)),
              genreIds,
              progressSeconds: cleanProgress,
              durationSeconds: cleanDuration,
              seasonNumber: cleanSeason,
              episodeNumber: cleanEpisode,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, itemPath);
        }
      }
    },
    [recordGenreInteraction, user]
  );

  const removeFromHistory = useCallback(
    async (id: number, mediaType: 'movie' | 'tv') => {
      setLocalHistory((prev) =>
        prev.filter((item) => !(item.id === id && item.media_type === mediaType))
      );
      if (user) {
        const docId = sanitizeDocId(`${mediaType}_${id}`);
        const itemPath = `users/${user.uid}/history/${docId}`;
        const itemRef = doc(db, 'users', user.uid, 'history', docId);
        try {
          await deleteDoc(itemRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, itemPath);
        }
      }
    },
    [user]
  );

  const openDetailsModal = useCallback(
    (item: TMDBMediaItem | { id: number; media_type: 'movie' | 'tv' }) => {
      const mediaType = inferMediaType(item);
      if ('genre_ids' in item && item.genre_ids) {
        recordGenreInteraction(item.genre_ids, 1);
      }
      setActiveDetails({
        id: item.id,
        mediaType,
        initialData: 'overview' in item ? item : undefined,
      });
    },
    [recordGenreInteraction]
  );

  const closeDetailsModal = useCallback(() => {
    setActiveDetails(null);
  }, []);

  const openTrailerModal = useCallback(
    (
      item: TMDBMediaItem | { id: number; media_type: 'movie' | 'tv'; title?: string },
      specificVideoKey?: string
    ) => {
      const mediaType = inferMediaType(item);
      if ('genre_ids' in item && item.genre_ids) {
        recordGenreInteraction(item.genre_ids, 2);
      }
      setActiveTrailer({
        id: item.id,
        mediaType,
        title: getDisplayTitle(item),
        videoKey: specificVideoKey,
      });
    },
    [recordGenreInteraction]
  );

  const closeTrailerModal = useCallback(() => {
    setActiveTrailer(null);
  }, []);

  const openWatchPlayer = useCallback(
    (item: TMDBMediaItem, seasonNumber = 1, episodeNumber = 1) => {
      const mediaType = inferMediaType(item);
      setActiveWatchPlayer({
        id: item.id,
        mediaType,
        title: getDisplayTitle(item),
        item,
        initialSeason: seasonNumber,
        initialEpisode: episodeNumber,
      });
      // Immediately record in viewing history so Continue Watching & Recommendations update
      recordWatchProgress(item, 15, 7200, seasonNumber, episodeNumber);
    },
    [recordWatchProgress]
  );

  const closeWatchPlayer = useCallback(() => {
    setActiveWatchPlayer(null);
  }, []);

  const openProfileModal = useCallback(() => {
    setProfileModalOpen(true);
  }, []);

  const closeProfileModal = useCallback(() => {
    setProfileModalOpen(false);
  }, []);

  const openByokModal = useCallback(() => {
    setByokModalOpen(true);
  }, []);

  const closeByokModal = useCallback(() => {
    setByokModalOpen(false);
  }, []);

  const value = useMemo<CineFlixContextValue>(
    () => ({
      user,
      userProfile,
      isAuthReady,
      authLoading,
      authError,
      signInWithGoogle,
      signOutUser,
      updateUserProfile,
      profileModalOpen,
      openProfileModal,
      closeProfileModal,
      byokModalOpen,
      openByokModal,
      closeByokModal,
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      toggleWatchlist,
      isInWatchlist,
      viewingHistory,
      recordWatchProgress,
      removeFromHistory,
      genreMap,
      movieGenres,
      tvGenres,
      genreAffinity: combinedGenreAffinity,
      recordGenreInteraction,
      getTopAffinityGenres,
      activeDetails,
      openDetailsModal,
      closeDetailsModal,
      activeTrailer,
      openTrailerModal,
      closeTrailerModal,
      activeWatchPlayer,
      openWatchPlayer,
      closeWatchPlayer,
    }),
    [
      user,
      userProfile,
      isAuthReady,
      authLoading,
      authError,
      signInWithGoogle,
      signOutUser,
      updateUserProfile,
      profileModalOpen,
      openProfileModal,
      closeProfileModal,
      byokModalOpen,
      openByokModal,
      closeByokModal,
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      toggleWatchlist,
      isInWatchlist,
      viewingHistory,
      recordWatchProgress,
      removeFromHistory,
      genreMap,
      movieGenres,
      tvGenres,
      combinedGenreAffinity,
      recordGenreInteraction,
      getTopAffinityGenres,
      activeDetails,
      openDetailsModal,
      closeDetailsModal,
      activeTrailer,
      openTrailerModal,
      closeTrailerModal,
      activeWatchPlayer,
      openWatchPlayer,
      closeWatchPlayer,
    ]
  );

  return <CineFlixContext.Provider value={value}>{children}</CineFlixContext.Provider>;
};

export function useCineFlix(): CineFlixContextValue {
  const ctx = useContext(CineFlixContext);
  if (!ctx) {
    throw new Error('useCineFlix must be used within a CineFlixProvider');
  }
  return ctx;
}
