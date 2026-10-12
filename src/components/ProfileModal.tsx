import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Check,
  Clock,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  clearByokCredential,
  getSavedByokCredential,
  getTMDBCredentials,
  saveByokCredential,
  validateTMDBCredential,
} from '../services/tmdb';

export const ProfileModal: React.FC = () => {
  const {
    user,
    userProfile,
    authLoading,
    authError,
    signInWithGoogle,
    signOutUser,
    updateUserProfile,
    profileModalOpen,
    closeProfileModal,
    movieGenres,
    watchlist,
    viewingHistory,
  } = useCineFlix();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [favoriteGenres, setFavoriteGenres] = useState<number[]>([]);
  const [autoplayTrailers, setAutoplayTrailers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // BYOK TMDB Key state inside Profile/Settings Modal
  const [byokKey, setByokKey] = useState(() => getSavedByokCredential());
  const [byokStatus, setByokStatus] = useState<string | null>(null);
  const [byokValidating, setByokValidating] = useState(false);

  const handleSaveByokInModal = async () => {
    const trimmed = byokKey.trim();
    if (!trimmed) {
      clearByokCredential();
      setByokStatus('Cleared custom TMDB key.');
      return;
    }
    setByokValidating(true);
    setByokStatus(null);
    const check = await validateTMDBCredential(trimmed);
    setByokValidating(false);
    if (!check.valid) {
      setByokStatus(check.errorMessage || 'Invalid TMDB key.');
      return;
    }
    saveByokCredential(trimmed);
    setByokStatus('Verified & saved TMDB key!');
  };

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
      setPhotoURL(userProfile.photoURL || '');
      setFavoriteGenres(userProfile.favoriteGenres || []);
      setAutoplayTrailers(userProfile.autoplayTrailers ?? true);
    } else if (user) {
      setDisplayName(user.displayName || 'CineFlix Member');
      setPhotoURL(user.photoURL || '');
      setBio('Cinema & television enthusiast on CineFlix.');
      setFavoriteGenres([28, 878, 18]);
      setAutoplayTrailers(true);
    }
  }, [userProfile, user, profileModalOpen]);

  useEffect(() => {
    if (!profileModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeProfileModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profileModalOpen, closeProfileModal]);

  if (!profileModalOpen) return null;

  const handleGenreToggle = (genreId: number) => {
    setFavoriteGenres((prev) => {
      if (prev.includes(genreId)) {
        return prev.filter((id) => id !== genreId);
      }
      if (prev.length >= 10) return prev;
      return [...prev, genreId];
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setLocalError('Display name is required.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    setSavedSuccess(false);

    try {
      await updateUserProfile({
        displayName: displayName.trim().slice(0, 80),
        bio: bio.trim().slice(0, 240),
        photoURL: photoURL.trim().slice(0, 500),
        favoriteGenres: favoriteGenres.slice(0, 10),
        autoplayTrailers,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Unable to save profile changes.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Account & Profile Settings"
      onClick={closeProfileModal}
    >
      <div
        className="relative w-full max-w-xl bg-[#111116] border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              {user ? 'Account & Profile Settings' : 'Sign In to CineFlix'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {user
                ? 'Manage your profile, favorite genres, and cross-device synced watchlist'
                : 'Sync your My List watchlist, playback progress, and personalized recommendations across devices'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeProfileModal}
            aria-label="Close account modal"
            className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!user ? (
          /* Signed-Out Authentication View */
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-4 rounded-xl bg-[#16161D] border border-white/[0.06] space-y-1.5">
                <Bookmark className="w-4 h-4 text-[#E50914]" />
                <h3 className="text-xs font-semibold text-white">Cloud My List</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Automatically sync your saved movies &amp; series across every device.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#16161D] border border-white/[0.06] space-y-1.5">
                <Sparkles className="w-4 h-4 text-[#E50914]" />
                <h3 className="text-xs font-semibold text-white">Tailored For You</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Dynamic TMDB recommendations powered by your viewing history.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#16161D] border border-white/[0.06] space-y-1.5">
                <Clock className="w-4 h-4 text-[#E50914]" />
                <h3 className="text-xs font-semibold text-white">Resume Playback</h3>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Pick up right where you left off in movies and TV episodes.
                </p>
              </div>
            </div>

            {(authError || localError) && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200">
                {authError || localError}
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch {
                  // Handled in context
                }
              }}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-[#E50914] hover:bg-[#F40612] disabled:opacity-50 text-white text-sm font-semibold shadow-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              <span>
                Any titles currently in your guest My List ({watchlist.length}) will automatically
                sync to your account upon sign-in.
              </span>
            </div>
          </div>
        ) : (
          /* Signed-In Profile Editor View */
          <form onSubmit={handleSaveProfile} className="pt-5 space-y-5">
            {/* Profile Summary Strip */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#16161D] border border-white/[0.06]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border border-white/15 flex items-center justify-center shrink-0">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{displayName}</p>
                  <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 font-mono-tabular">
                    <span>{watchlist.length} in My List</span>
                    <span aria-hidden="true">·</span>
                    <span>{viewingHistory.length} Watched</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={signOutUser}
                disabled={authLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-xs font-semibold text-zinc-300 hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Form Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#0B0B0F] border border-white/15 focus:border-[#E50914] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Avatar URL (optional)
                </label>
                <input
                  type="url"
                  maxLength={500}
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#0B0B0F] border border-white/15 focus:border-[#E50914] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Profile Bio ({bio.length}/240)
              </label>
              <textarea
                rows={2}
                maxLength={240}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us what kind of movies and series you love..."
                className="w-full bg-[#0B0B0F] border border-white/15 focus:border-[#E50914] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none resize-none"
              />
            </div>

            {/* Favorite Genres Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Preferred Genres for Homepage Recommendations ({favoriteGenres.length}/10)
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 rounded-xl bg-[#0B0B0F] border border-white/10">
                {(movieGenres.length > 0
                  ? movieGenres
                  : [
                      { id: 28, name: 'Action' },
                      { id: 12, name: 'Adventure' },
                      { id: 16, name: 'Animation' },
                      { id: 35, name: 'Comedy' },
                      { id: 80, name: 'Crime' },
                      { id: 18, name: 'Drama' },
                      { id: 14, name: 'Fantasy' },
                      { id: 27, name: 'Horror' },
                      { id: 9648, name: 'Mystery' },
                      { id: 10749, name: 'Romance' },
                      { id: 878, name: 'Sci-Fi' },
                      { id: 53, name: 'Thriller' },
                    ]
                ).map((g) => {
                  const selected = favoriteGenres.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleGenreToggle(g.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-[#E50914] text-white'
                          : 'bg-[#16161D] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Autoplay Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#16161D] border border-white/[0.06] cursor-pointer">
              <div>
                <p className="text-xs font-semibold text-white">Autoplay Streams &amp; Trailers</p>
                <p className="text-[11px] text-zinc-400">
                  Start playback automatically when opening the player modal
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoplayTrailers}
                onChange={(e) => setAutoplayTrailers(e.target.checked)}
                className="w-4 h-4 accent-[#E50914] rounded cursor-pointer"
              />
            </label>

            {localError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/30 text-xs text-red-200">
                {localError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeProfileModal}
                className="px-4 py-2.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E50914] hover:bg-[#F40612] disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved to Cloud</span>
                  </>
                ) : (
                  <span>{saving ? 'Saving...' : 'Save Profile Preferences'}</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* BYOK (Bring Your Own Key) TMDB API Key Manager */}
        <div className="mt-6 pt-5 border-t border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <KeyRound className="w-4 h-4 text-[#E50914]" />
              <span>TMDB API Key (BYOK System)</span>
            </div>
            <span className="text-[11px] font-mono-tabular text-zinc-400">
              {getTMDBCredentials().source === 'byok'
                ? 'Active: Custom BYOK Key'
                : getTMDBCredentials().source === 'env'
                ? 'Active: Environment Token'
                : 'Not Configured'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={byokKey}
              onChange={(e) => {
                setByokKey(e.target.value);
                setByokStatus(null);
              }}
              placeholder="Paste TMDB v3 API Key or v4 Bearer Token..."
              className="flex-1 bg-[#0B0B0F] border border-white/15 focus:border-[#E50914] rounded-lg px-3.5 py-2 text-xs text-white font-mono-tabular focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveByokInModal}
              disabled={byokValidating}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {byokValidating ? 'Verifying...' : 'Verify & Save Key'}
            </button>
            {byokKey && (
              <button
                type="button"
                onClick={() => {
                  clearByokCredential();
                  setByokKey('');
                  setByokStatus('Removed custom key.');
                }}
                aria-label="Clear custom TMDB key"
                className="p-2 rounded-lg bg-white/[0.06] hover:bg-red-950/60 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {byokStatus && (
            <p className="text-xs text-zinc-300">{byokStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
};
