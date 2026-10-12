import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';
import {
  clearByokCredential,
  clearTMDBCache,
  getSavedByokCredential,
  getTMDBCredentials,
  saveByokCredential,
  validateTMDBCredential,
} from '../services/tmdb';

export const ByokKeyModal: React.FC = () => {
  const { byokModalOpen, closeByokModal } = useCineFlix();
  const [keyInput, setKeyInput] = useState(() => getSavedByokCredential());
  const [showSecret, setShowSecret] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

  // Sync state whenever modal opens
  useEffect(() => {
    if (byokModalOpen) {
      setKeyInput(getSavedByokCredential());
      setValidationError(null);
      setValidationSuccess(null);
    }
  }, [byokModalOpen]);

  // Handle ESC shortcut
  useEffect(() => {
    if (!byokModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeByokModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [byokModalOpen, closeByokModal]);

  if (!byokModalOpen) return null;

  const currentCreds = getTMDBCredentials();

  const handleSaveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setValidationError('Please enter a TMDB API Key (v3) or Read Access Token (v4).');
      return;
    }

    setValidating(true);
    setValidationError(null);
    setValidationSuccess(null);

    const check = await validateTMDBCredential(trimmed);
    setValidating(false);

    if (!check.valid) {
      setValidationError(
        check.errorMessage ||
          'Invalid TMDB API Key or Token. Please verify at themoviedb.org/settings/api.'
      );
      return;
    }

    saveByokCredential(trimmed);
    clearTMDBCache();
    setValidationSuccess(
      `Key verified successfully (${check.mode === 'api_key' ? 'v3 API Key' : 'v4 Bearer Token'}). Continuing...`
    );

    setTimeout(() => {
      closeByokModal();
      // Trigger a light refresh if on a page that was waiting for key
      window.dispatchEvent(new Event('cineflix_byok_updated'));
    }, 500);
  };

  const handleClear = () => {
    clearByokCredential();
    clearTMDBCache();
    setKeyInput('');
    setValidationError(null);
    setValidationSuccess('BYOK key removed. CineFlix will fall back to environment variables.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="byok-modal-title"
      onClick={closeByokModal}
    >
      <div
        className="relative w-full max-w-lg bg-[#111116] border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914] shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-tabular uppercase tracking-wider font-bold text-[#E50914]">
                  BYOK SYSTEM
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-[11px] text-zinc-400">Bring Your Own Key</span>
              </div>
              <h2 id="byok-modal-title" className="text-lg font-bold text-white">
                TMDB API Key Settings
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeByokModal}
            aria-label="Close API Key modal"
            className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Status Badge */}
        <div className="px-4 py-3 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                currentCreds.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-zinc-300">
              Status:{' '}
              <strong className={currentCreds.isConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                {currentCreds.isConfigured
                  ? currentCreds.source === 'byok'
                    ? 'Active (Custom BYOK Key)'
                    : 'Active (Environment Secret)'
                  : 'No Key Configured'}
              </strong>
            </span>
          </div>

          {currentCreds.source === 'byok' && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Key</span>
            </button>
          )}
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Provide your own <strong>The Movie Database (TMDB) API Key</strong> (v3 32-character key)
          or <strong>API Read Access Token</strong> (v4 Bearer). Your key is stored securely in your
          browser&apos;s localStorage and unlocks instant live access to movies, TV shows, and discovery.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSaveAndContinue} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="byok-modal-input" className="font-semibold text-zinc-200">
                TMDB API Key / Access Token:
              </label>
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E50914] hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative flex items-center">
              <input
                id="byok-modal-input"
                type={showSecret ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setValidationError(null);
                  setValidationSuccess(null);
                }}
                placeholder="Paste your 32-char API Key or eyJ... Read Access Token"
                className="w-full bg-[#08080B] border border-white/15 focus:border-[#E50914] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white font-mono-tabular placeholder-zinc-500 focus:outline-none"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowSecret((prev) => !prev)}
                className="absolute right-3 text-zinc-400 hover:text-white cursor-pointer"
                aria-label={showSecret ? 'Hide key' : 'Show key'}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Validation Feedback */}
          {validationError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {validationSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{validationSuccess}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeByokModal}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={validating || !keyInput.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#F40612] disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              {validating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validating Key...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify & Save Key</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Helpful Tip */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2 text-[11px] text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-[#E50914] shrink-0" />
          <span>
            Need help? On TMDB go to <strong>Settings → API → Create API Key (Developer)</strong>. It is 100% free with no credit card required.
          </span>
        </div>
      </div>
    </div>
  );
};
