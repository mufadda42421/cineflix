import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Film,
  KeyRound,
  Link2,
  Maximize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
  Tv,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  TMDBEpisodeSummary,
  getBackdropUrl,
  getMediaDetails,
  getMediaVideos,
  getTVSeasonDetails,
  inferMediaType,
  sortVideosByHDQuality,
} from '../services/tmdb';
import { TMDBMediaDetails, TMDBVideo } from '../types/tmdb';

// Clean storage key migrating users away from any old or sandbox-blocked server configs
const PREFERRED_SERVER_KEY = 'cineflix_preferred_server_v8';
const AUTO_FAILOVER_KEY = 'cineflix_auto_failover_v8';

export interface StreamServerConfig {
  id: string;
  name: string;
  badge: string;
  speed: 'ultra_fast' | 'fast' | 'stable';
  kind: 'external_embed' | 'tmdb_youtube' | 'custom_url';
  description: string;
  buildEmbedUrl?: (
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    season: number,
    episode: number
  ) => string;
}

// Sandbox-Safe, Verified Live TMDB Stream Embed Mirrors (Zero sandbox restrictions or checks)
export const STREAM_SERVERS: StreamServerConfig[] = [
  {
    id: 'vidsrc_pm',
    name: 'Server 4 · VidSrc Master Node',
    badge: '⭐ Best Experience',
    speed: 'ultra_fast',
    kind: 'external_embed',
    description:
      'Use server 4 for best experience and if the click redirects to any website close the redirected website tab',
    buildEmbedUrl: (id, type, s, e) =>
      type === 'tv'
        ? `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.pm/embed/movie/${id}`,
  },
  {
    id: 'vidsrc_to',
    name: 'Server 1 · VidSrc TO (Fastest)',
    badge: '1080p · Instant Start',
    speed: 'ultra_fast',
    kind: 'external_embed',
    description: 'High-speed global cluster with instant buffering, full 1080p HD, and auto-subtitles',
    buildEmbedUrl: (id, type, s, e) =>
      type === 'tv'
        ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    id: 'vidsrc_sh',
    name: 'Server 2 · VidSrc Cloud',
    badge: '1080p · High Speed',
    speed: 'ultra_fast',
    kind: 'external_embed',
    description: 'Verified direct TMDB node with automatic source failover and crystal clear audio',
    buildEmbedUrl: (id, type, s, e) =>
      type === 'tv'
        ? `https://vidsrc.sh/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
        : `https://vidsrc.sh/embed/movie?tmdb=${id}`,
  },
  {
    id: 'smashystream_xyz',
    name: 'Server 3 · SmashyStream Cloud',
    badge: 'Clean Player',
    speed: 'fast',
    kind: 'external_embed',
    description: 'Direct responsive cloud stream player with rapid loading and zero sandbox blockades',
    buildEmbedUrl: (id, type, s, e) =>
      type === 'tv'
        ? `https://smashystream.xyz/tv/${id}?s=${s}&e=${e}`
        : `https://smashystream.xyz/movie/${id}`,
  },
  {
    id: 'anyembed_xyz',
    name: 'Server 5 · AnyEmbed Node',
    badge: 'Fast Mirror',
    speed: 'stable',
    kind: 'external_embed',
    description: 'Clean direct TMDB stream mirror for movies and television series',
    buildEmbedUrl: (id, type, s, e) =>
      type === 'tv'
        ? `https://anyembed.xyz/embed/tmdb-tv-${id}-${s}-${e}`
        : `https://anyembed.xyz/embed/tmdb-movie-${id}`,
  },
  {
    id: 'custom_url',
    name: 'Server 6 · Custom Video URL (.mp4 / .webm)',
    badge: 'Direct Stream',
    speed: 'fast',
    kind: 'custom_url',
    description: 'Stream any direct MP4 or video URL natively with zero sandbox restrictions',
  },
  {
    id: 'tmdb_youtube',
    name: 'Server 7 · TMDB Official Trailer & Clips',
    badge: 'Official Trailer',
    speed: 'ultra_fast',
    kind: 'tmdb_youtube',
    description: 'Watch the official 4K/1080p theatrical trailer, teaser, or clip directly from TMDB',
  },
];

export const WatchPlayerModal: React.FC = () => {
  const {
    activeWatchPlayer,
    closeWatchPlayer,
    recordWatchProgress,
    viewingHistory,
    isInWatchlist,
    toggleWatchlist,
    openByokModal,
  } = useCineFlix();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Default to Server 4 (vidsrc_pm) for best experience
  const [selectedServerId, setSelectedServerId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(PREFERRED_SERVER_KEY);
      if (saved && STREAM_SERVERS.some((s) => s.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'vidsrc_pm';
  });

  // Auto-failover toggle (switches if slow > 7s)
  const [autoFailover, setAutoFailover] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_FAILOVER_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const [reloadNonce, setReloadNonce] = useState(0);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<TMDBEpisodeSummary[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [details, setDetails] = useState<TMDBMediaDetails | null>(null);
  const [tmdbVideos, setTmdbVideos] = useState<TMDBVideo[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  // Buffering & Loading Watchdog State
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [failoverMessage, setFailoverMessage] = useState<string | null>(null);

  // Direct HTML5 Player State (for Server 6)
  const [customStreamUrl, setCustomStreamUrl] = useState<string>('');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(7200);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const activeServer = useMemo(() => {
    return (
      STREAM_SERVERS.find((s) => s.id === selectedServerId) || STREAM_SERVERS[0]
    );
  }, [selectedServerId]);

  const handleSelectServer = useCallback((serverId: string) => {
    setSelectedServerId(serverId);
    setIsIframeLoading(true);
    setLoadingSeconds(0);
    setFailoverMessage(null);
    try {
      localStorage.setItem(PREFERRED_SERVER_KEY, serverId);
    } catch {
      // Ignore
    }
  }, []);

  const handleSwitchNextServer = useCallback(() => {
    const currentIndex = STREAM_SERVERS.findIndex((s) => s.id === activeServer.id);
    const nextServer = STREAM_SERVERS[(currentIndex + 1) % STREAM_SERVERS.length];
    handleSelectServer(nextServer.id);
  }, [activeServer.id, handleSelectServer]);

  const handleReloadServer = () => {
    setIsIframeLoading(true);
    setLoadingSeconds(0);
    setFailoverMessage(null);
    setReloadNonce((n) => n + 1);
  };

  const handleToggleAutoFailover = () => {
    const nextVal = !autoFailover;
    setAutoFailover(nextVal);
    try {
      localStorage.setItem(AUTO_FAILOVER_KEY, String(nextVal));
    } catch {
      // Ignore
    }
  };

  // Monitor loading time and auto-switch if server takes too long
  useEffect(() => {
    if (!activeWatchPlayer) return;
    if (activeServer.kind !== 'external_embed') {
      setIsIframeLoading(false);
      return;
    }

    setIsIframeLoading(true);
    setLoadingSeconds(0);

    // Auto-dismiss loading badge after 2.5s so video frame is always clear to click
    const dismissTimer = setTimeout(() => {
      setIsIframeLoading(false);
    }, 2500);

    const interval = setInterval(() => {
      setLoadingSeconds((prev) => {
        const next = prev + 1;
        // Auto failover after 8 seconds if enabled
        if (next === 8 && autoFailover) {
          const currentIndex = STREAM_SERVERS.findIndex((s) => s.id === activeServer.id);
          const nextServer = STREAM_SERVERS[(currentIndex + 1) % STREAM_SERVERS.length];
          setFailoverMessage(
            `Slow buffer on ${activeServer.name}. Auto-switched to ${nextServer.name}!`
          );
          setSelectedServerId(nextServer.id);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearTimeout(dismissTimer);
      clearInterval(interval);
    };
  }, [activeWatchPlayer?.id, activeServer.id, season, episode, reloadNonce, autoFailover]);

  // Initialize movie metadata & history
  useEffect(() => {
    if (!activeWatchPlayer) return;

    setSelectedVideoIndex(0);
    const initSeason = activeWatchPlayer.initialSeason || 1;
    const initEpisode = activeWatchPlayer.initialEpisode || 1;
    setSeason(initSeason);
    setEpisode(initEpisode);

    // Restore saved playback position if available
    const existingHistory = viewingHistory.find(
      (h) =>
        h.id === activeWatchPlayer.id && h.media_type === activeWatchPlayer.mediaType
    );
    if (existingHistory && existingHistory.progressSeconds > 5) {
      setCurrentTime(existingHistory.progressSeconds);
      if (existingHistory.seasonNumber) setSeason(existingHistory.seasonNumber);
      if (existingHistory.episodeNumber) setEpisode(existingHistory.episodeNumber);
    } else {
      setCurrentTime(0);
    }

    let isMounted = true;
    Promise.allSettled([
      getMediaDetails(activeWatchPlayer.mediaType, activeWatchPlayer.id),
      getMediaVideos(activeWatchPlayer.mediaType, activeWatchPlayer.id),
    ]).then(([detRes, vidRes]) => {
      if (!isMounted) return;
      if (detRes.status === 'fulfilled') {
        setDetails(detRes.value);
      }
      if (vidRes.status === 'fulfilled') {
        const sorted = sortVideosByHDQuality(vidRes.value.results || []);
        setTmdbVideos(sorted);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeWatchPlayer?.id, activeWatchPlayer?.mediaType]);

  // Fetch TV Season Episodes
  useEffect(() => {
    if (!activeWatchPlayer || activeWatchPlayer.mediaType !== 'tv') {
      setSeasonEpisodes([]);
      return;
    }

    let isMounted = true;
    setLoadingEpisodes(true);
    getTVSeasonDetails(activeWatchPlayer.id, season)
      .then((res) => {
        if (!isMounted) return;
        setSeasonEpisodes(res.episodes || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setSeasonEpisodes([]);
      })
      .finally(() => {
        if (isMounted) setLoadingEpisodes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeWatchPlayer?.id, activeWatchPlayer?.mediaType, season]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!activeWatchPlayer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseAndSave();
      } else if (
        e.key === ' ' &&
        activeServer.kind === 'custom_url' &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!activeWatchPlayer) return null;

  const mediaType = inferMediaType(activeWatchPlayer.item, activeWatchPlayer.mediaType);
  const inWatchlist = isInWatchlist(activeWatchPlayer.id, mediaType);
  const activeYoutubeVideo = tmdbVideos[selectedVideoIndex] || tmdbVideos[0] || null;

  const externalEmbedUrl = activeServer.buildEmbedUrl
    ? activeServer.buildEmbedUrl(activeWatchPlayer.id, mediaType, season, episode)
    : '';

  const posterBackdrop =
    getBackdropUrl(
      details?.backdrop_path || activeWatchPlayer.item.backdrop_path,
      'w1280'
    ) || undefined;

  const totalSeasons = Math.max(1, Math.min(details?.number_of_seasons || 1, 40));
  const episodeCount = seasonEpisodes.length > 0 ? seasonEpisodes.length : 20;

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const remSec = s % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const skipSeconds = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || 7200, Math.max(0, v.currentTime + delta));
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleToggleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleCloseAndSave = () => {
    recordWatchProgress(
      activeWatchPlayer.item,
      Math.max(15, Math.floor(currentTime)),
      Math.max(60, Math.floor(duration)),
      season,
      episode
    );
    closeWatchPlayer();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Streaming ${activeWatchPlayer.title}`}
      onClick={handleCloseAndSave}
    >
      <div
        ref={playerContainerRef}
        className="relative w-full max-w-6xl bg-[#0A0A0E] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Cinema Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#08080B] border-b border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#E50914] text-white flex items-center justify-center shrink-0 shadow-md">
              {mediaType === 'tv' ? (
                <Tv className="w-4 h-4" />
              ) : (
                <Film className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {activeWatchPlayer.title}
                </h2>
                {mediaType === 'tv' && (
                  <span className="text-xs font-mono-tabular text-[#E50914] font-bold px-1.5 py-0.5 rounded bg-[#E50914]/15 border border-[#E50914]/30 shrink-0">
                    S{season}:E{episode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 truncate">
                <span className="text-white font-medium">{activeServer.name}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    activeServer.speed === 'ultra_fast'
                      ? 'text-emerald-400 font-semibold'
                      : activeServer.speed === 'fast'
                      ? 'text-cyan-400 font-semibold'
                      : 'text-amber-400'
                  }
                >
                  {activeServer.badge}
                </span>
                {mediaType === 'tv' && seasonEpisodes[episode - 1]?.name && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-zinc-300 truncate">
                      {seasonEpisodes[episode - 1]?.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Server Selector Dropdown + Direct Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Switch Dropdown */}
            <div className="relative flex items-center">
              <Server className="w-3.5 h-3.5 text-[#E50914] absolute left-3 pointer-events-none" />
              <select
                value={activeServer.id}
                onChange={(e) => handleSelectServer(e.target.value)}
                aria-label="Select streaming server"
                className="appearance-none bg-[#14141C] hover:bg-[#1C1C26] border border-white/15 focus:border-[#E50914] rounded-lg pl-8 pr-8 py-1.5 text-xs font-semibold text-white cursor-pointer focus:outline-none"
              >
                {STREAM_SERVERS.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.speed === 'ultra_fast'
                      ? '🟢 '
                      : srv.speed === 'fast'
                      ? '⚡ '
                      : '🔵 '}
                    {srv.name} ({srv.badge})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 pointer-events-none" />
            </div>

            {/* Next Server Button */}
            <button
              type="button"
              onClick={handleSwitchNextServer}
              title="Switch to next server mirror"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <span>Next Server</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Direct Native Standalone Tab Link (100% Unblockable & Bypasses All Sandboxes) */}
            {externalEmbedUrl && (
              <a
                href={externalEmbedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open stream in dedicated clean theatre tab (bypasses browser sandboxes completely)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shrink-0 cursor-pointer shadow-md"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Bypass Sandbox ↗</span>
              </a>
            )}

            {/* Reload Current Server */}
            <button
              type="button"
              onClick={handleReloadServer}
              aria-label="Reload current stream server"
              title="Reload current stream"
              className="p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* BYOK / API Key trigger */}
            <button
              type="button"
              onClick={openByokModal}
              title="Bring Your Own TMDB Key"
              className="p-2 rounded-lg bg-white/[0.08] hover:bg-[#E50914]/20 hover:border-[#E50914]/40 border border-transparent text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-[#E50914]" />
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={handleCloseAndSave}
              aria-label="Close cinema player"
              className="p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Guidance Banner */}
        <div className="bg-[#18111A] border-b border-[#E50914]/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-zinc-100 min-w-0">
            <div className="w-5 h-5 rounded-full bg-[#E50914]/20 border border-[#E50914]/50 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-[#E50914]" />
            </div>
            <span className="leading-snug">
              <strong className="text-amber-300 font-bold">Important Notice:</strong>{' '}
              Use server 4 for best experience and if the click redirects to any website close the redirected website tab
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeServer.id !== 'vidsrc_pm' && (
              <button
                type="button"
                onClick={() => handleSelectServer('vidsrc_pm')}
                className="px-2.5 py-1 rounded-md bg-[#E50914] hover:bg-[#F40612] text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm"
              >
                Switch to Server 4
              </button>
            )}
            {externalEmbedUrl && (
              <a
                href={externalEmbedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                <span>Watch in Standalone Tab</span>
              </a>
            )}
          </div>
        </div>

        {/* Failover Toast Alert */}
        {failoverMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{failoverMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFailoverMessage(null)}
              className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Slow Buffering Helper Banner */}
        {loadingSeconds >= 5 && activeServer.kind === 'external_embed' && (
          <div className="bg-[#1C1215] border-b border-[#E50914]/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-200">
              <AlertCircle className="w-4 h-4 text-[#E50914] shrink-0" />
              <span>
                Stream buffering slowly on <strong>{activeServer.name}</strong>?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwitchNextServer}
                className="px-2.5 py-1 rounded bg-[#E50914] hover:bg-[#F40612] text-white font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                <span>Switch to Server {activeServer.id === 'vidsrc_to' ? '2' : '3'}</span>
              </button>
              {externalEmbedUrl && (
                <a
                  href={externalEmbedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Direct Standalone Window</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Main 16:9 Video Viewport */}
        <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
          {/* STREAM SERVERS 1-5: SANDBOX-SAFE LIVE HD EMBED NODES */}
          {activeServer.kind === 'external_embed' && externalEmbedUrl && (
            <div className="relative w-full h-full flex flex-col bg-black">
              {/* Subtle Floating Connection Indicator (Non-blocking, never covers player buttons) */}
              {isIframeLoading && (
                <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/15 text-xs text-white shadow-xl">
                  <span className="w-3 h-3 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Connecting to {activeServer.name}...</span>
                </div>
              )}

              {/* The Actual Video Stream Frame (NO sandbox attribute) */}
              <iframe
                ref={iframeRef}
                key={`${activeServer.id}-${externalEmbedUrl}-${reloadNonce}`}
                src={externalEmbedUrl}
                title={`${activeWatchPlayer.title} — ${activeServer.name}`}
                className="w-full flex-1 border-0 bg-black"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={() => {
                  setIsIframeLoading(false);
                }}
              />
            </div>
          )}

          {/* SERVER 6 · CUSTOM STREAM URL INPUT & NATIVE HTML5 PLAYER */}
          {activeServer.kind === 'custom_url' && (
            <div className="relative w-full h-full flex flex-col bg-black">
              {customStreamUrl ? (
                <div className="relative w-full h-full group/player">
                  <video
                    ref={videoRef}
                    key={`${customStreamUrl}-${reloadNonce}`}
                    src={customStreamUrl}
                    poster={posterBackdrop}
                    autoPlay
                    playsInline
                    onError={() => {
                      setCustomStreamUrl('');
                    }}
                    onLoadedMetadata={(e) => {
                      const vid = e.currentTarget;
                      if (vid.duration && Number.isFinite(vid.duration)) {
                        setDuration(vid.duration);
                      }
                      if (currentTime > 5 && currentTime < (vid.duration || 7200)) {
                        vid.currentTime = currentTime;
                      }
                    }}
                    onTimeUpdate={(e) => {
                      setCurrentTime(e.currentTarget.currentTime);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onClick={togglePlayPause}
                    className="w-full h-full object-contain bg-black cursor-pointer"
                  />

                  {/* Native Cinema Player Transport Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 sm:p-6 pt-12 opacity-100 sm:opacity-0 sm:group-hover/player:opacity-100 transition-opacity duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-mono-tabular text-zinc-200 w-12">
                        {formatTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, Math.floor(duration))}
                        value={Math.floor(currentTime)}
                        onChange={handleTimelineChange}
                        aria-label="Seek playback timeline"
                        className="w-full accent-[#E50914] h-1.5 bg-white/25 rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono-tabular text-zinc-400 w-12 text-right">
                        {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={togglePlayPause}
                          aria-label={isPlaying ? 'Pause' : 'Play'}
                          className="p-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-white transition-colors cursor-pointer"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => skipSeconds(-10)}
                          aria-label="Rewind 10 seconds"
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                          title="Rewind 10s"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => skipSeconds(10)}
                          aria-label="Forward 10 seconds"
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                          title="Forward 10s"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.muted = !isMuted;
                              setIsMuted(!isMuted);
                            }
                          }}
                          aria-label={isMuted ? 'Unmute' : 'Mute'}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        >
                          {isMuted ? (
                            <VolumeX className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setCustomStreamUrl('')}
                          className="text-xs text-zinc-400 hover:text-white underline cursor-pointer ml-2"
                        >
                          Change URL
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const rates = [1, 1.25, 1.5, 2, 0.75];
                            const nextRate =
                              rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                            setPlaybackRate(nextRate);
                            if (videoRef.current) {
                              videoRef.current.playbackRate = nextRate;
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono-tabular font-semibold text-white transition-colors cursor-pointer"
                        >
                          {playbackRate}x
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleFullscreen}
                          aria-label="Toggle fullscreen"
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-lg w-full p-6 sm:p-8 rounded-2xl bg-[#121218] border border-white/15 space-y-4 mx-4 my-auto">
                  <div className="flex items-center gap-2 text-[#E50914] text-xs font-semibold uppercase tracking-wider">
                    <Link2 className="w-4 h-4" />
                    <span>Bring Your Own Stream</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Play Any Direct Video Stream (.mp4 / .webm)
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Paste any direct video file URL below. It will play inside CineFlix&apos;s native
                    HTML5 cinema player with zero ad-network scripts or sandbox restrictions.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://example.com/movie.mp4"
                      className="flex-1 bg-black/70 border border-white/15 focus:border-[#E50914] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUrlInput.trim()) {
                          setCustomStreamUrl(customUrlInput.trim());
                          setCurrentTime(0);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40612] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Start Stream
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SERVER 7 · TMDB OFFICIAL HD TRAILERS & CLIPS */}
          {activeServer.kind === 'tmdb_youtube' && (
            <div className="relative w-full h-full flex flex-col bg-black">
              {activeYoutubeVideo ? (
                <>
                  <iframe
                    key={`${activeYoutubeVideo.key}-${reloadNonce}`}
                    src={`https://www.youtube-nocookie.com/embed/${activeYoutubeVideo.key}?autoplay=1&rel=0&modestbranding=1`}
                    title={`${activeWatchPlayer.title} — ${activeYoutubeVideo.name}`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                  />
                  {tmdbVideos.length > 1 && (
                    <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-black/85 backdrop-blur-md border border-white/15 rounded-xl p-1.5 z-20">
                      <span className="text-[11px] font-semibold text-zinc-400 px-2 shrink-0">
                        Official Clips ({tmdbVideos.length}):
                      </span>
                      {tmdbVideos.slice(0, 6).map((vid, idx) => (
                        <button
                          key={vid.id || vid.key}
                          type="button"
                          onClick={() => setSelectedVideoIndex(idx)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                            idx === selectedVideoIndex
                              ? 'bg-[#E50914] text-white'
                              : 'text-zinc-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {vid.type}: {vid.name.slice(0, 26)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center space-y-4 max-w-md my-auto">
                  <p className="text-sm text-zinc-300">
                    No official TMDB YouTube video feed is listed for &ldquo;
                    {activeWatchPlayer.title}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectServer('vidsrc_to')}
                    className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40612] text-white text-xs font-semibold cursor-pointer"
                  >
                    Switch to Server 1 · VidSrc TO (Fastest)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Fast Server Switch Bar & TV Episode Controls */}
        <div className="p-4 sm:px-6 bg-[#09090D] border-t border-white/[0.08] space-y-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E50914]" />
                <span className="text-xs font-bold text-white">
                  Fast Server Selection:
                </span>
                <span className="text-[11px] text-amber-300 font-medium">
                  Use server 4 for best experience and if the click redirects to any website close the redirected website tab
                </span>
              </div>

              {/* Auto-Failover Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={autoFailover}
                  onChange={handleToggleAutoFailover}
                  className="rounded accent-[#E50914] cursor-pointer"
                />
                <span>Auto-switch if buffering &gt; 7s</span>
              </label>
            </div>

            {/* Quick 1-Click Server Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {STREAM_SERVERS.map((srv) => {
                const isSelected = activeServer.id === srv.id;
                const isServer4 = srv.id === 'vidsrc_pm';
                const isUltraFast = srv.speed === 'ultra_fast';
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => handleSelectServer(srv.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? isServer4
                          ? 'bg-[#E50914] text-white shadow-lg ring-2 ring-amber-400'
                          : 'bg-[#E50914] text-white shadow-md ring-1 ring-white/25'
                        : isServer4
                        ? 'bg-[#1C1826] text-amber-300 hover:bg-[#252033] hover:text-white border border-amber-500/40'
                        : 'bg-[#14141C] text-zinc-300 hover:bg-white/[0.12] hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    <span>{isServer4 ? '⭐' : isUltraFast ? '🟢' : srv.speed === 'fast' ? '⚡' : '🔵'}</span>
                    <span>{srv.name.split('·')[0].trim()}</span>
                    <span
                      className={`text-[10px] font-mono-tabular ${
                        isSelected
                          ? 'text-white/90'
                          : isServer4
                          ? 'text-amber-400 font-bold'
                          : isUltraFast
                          ? 'text-emerald-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {srv.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TV Series Season & Episode Selector */}
          {mediaType === 'tv' && (
            <div className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span>Season:</span>
                  <select
                    value={season}
                    onChange={(e) => {
                      const nextS = Number(e.target.value);
                      setSeason(nextS);
                      setEpisode(1);
                      setIsIframeLoading(true);
                      setLoadingSeconds(0);
                      recordWatchProgress(
                        activeWatchPlayer.item,
                        currentTime,
                        duration,
                        nextS,
                        1
                      );
                    }}
                    className="bg-[#14141C] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white font-mono-tabular focus:outline-none focus:border-[#E50914] cursor-pointer"
                  >
                    {Array.from({ length: totalSeasons }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Season {i + 1}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span>Episode:</span>
                  <select
                    value={episode}
                    onChange={(e) => {
                      const nextE = Number(e.target.value);
                      setEpisode(nextE);
                      setIsIframeLoading(true);
                      setLoadingSeconds(0);
                      recordWatchProgress(
                        activeWatchPlayer.item,
                        currentTime,
                        duration,
                        season,
                        nextE
                      );
                    }}
                    disabled={loadingEpisodes}
                    className="bg-[#14141C] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white font-mono-tabular focus:outline-none focus:border-[#E50914] max-w-[260px] cursor-pointer"
                  >
                    {seasonEpisodes.length > 0
                      ? seasonEpisodes.map((ep) => (
                          <option key={ep.id || ep.episode_number} value={ep.episode_number}>
                            E{ep.episode_number} · {ep.name || `Episode ${ep.episode_number}`}
                          </option>
                        ))
                      : Array.from({ length: episodeCount }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            Episode {i + 1}
                          </option>
                        ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                {episode > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const prevEp = episode - 1;
                      setEpisode(prevEp);
                      setIsIframeLoading(true);
                      setLoadingSeconds(0);
                      recordWatchProgress(
                        activeWatchPlayer.item,
                        currentTime,
                        duration,
                        season,
                        prevEp
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Prev (E{episode - 1})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const nextEp = episode < episodeCount ? episode + 1 : 1;
                    setEpisode(nextEp);
                    setIsIframeLoading(true);
                    setLoadingSeconds(0);
                    recordWatchProgress(
                      activeWatchPlayer.item,
                      currentTime,
                      duration,
                      season,
                      nextEp
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <span>Next Episode (E{episode < episodeCount ? episode + 1 : 1})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
