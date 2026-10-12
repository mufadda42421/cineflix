import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  TMDBApiError,
  clearByokCredential,
  clearTMDBCache,
  getSavedByokCredential,
  saveByokCredential,
  validateTMDBCredential,
} from '../services/tmdb';

interface ApiSetupGuideProps {
  error?: TMDBApiError | Error | null;
  onRetry?: () => void;
  compact?: boolean;
}

export const ApiSetupGuide: React.FC<ApiSetupGuideProps> = ({
  error,
  onRetry,
  compact = false,
}) => {
  const [keyInput, setKeyInput] = useState(() => getSavedByokCredential());
  const [showSecret, setShowSecret] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  const handleRetry = () => {
    clearTMDBCache();
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleByokSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setValidationError('Please paste your TMDB API Key (v3) or Read Access Token (v4).');
      return;
    }

    setValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    const check = await validateTMDBCredential(trimmed);
    setValidating(false);

    if (!check.valid) {
      setValidationError(
        check.errorMessage || 'Invalid TMDB API Key or Read Access Token. Please double-check it.'
      );
      return;
    }

    saveByokCredential(trimmed);
    setValidationSuccess(true);

    // Immediately continue to the app
    setTimeout(() => {
      handleRetry();
    }, 250);
  };

  const handleClearKey = () => {
    clearByokCredential();
    setKeyInput('');
    setValidationError(null);
    setValidationSuccess(false);
  };

  if (compact) {
    return (
      <div className="rounded-xl bg-[#121216] border border-white/10 p-6 text-zinc-300">
        <form onSubmit={handleByokSubmit} className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#E50914] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                {error?.message || 'Bring Your Own TMDB API Key (BYOK)'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Paste a TMDB v3 API Key or v4 Read Access Token below to continue immediately.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type={showSecret ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste TMDB API Key or Bearer Read Access Token..."
              className="flex-1 bg-[#09090C] border border-white/15 focus:border-[#E50914] rounded-lg px-3.5 py-2 text-xs text-white font-mono-tabular focus:outline-none"
            />
            <button
              type="submit"
              disabled={validating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#E50914] hover:bg-[#F40612] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{validating ? 'Verifying...' : 'Save & Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {validationError && (
            <p className="text-xs text-red-400">{validationError}</p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto my-8 px-6">
      <div className="rounded-2xl bg-[#111116] border border-white/15 p-7 md:p-10 shadow-2xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 text-[#E50914] mb-3">
            <KeyRound className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              BYOK · Bring Your Own Key System
            </span>
          </div>

          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Enter Your TMDB API Key to Continue
          </h2>

          <p className="mt-2.5 text-sm md:text-base text-zinc-400 leading-relaxed">
            Paste either your <strong>TMDB API Key (v3)</strong> or{' '}
            <strong>API Read Access Token (v4 Bearer)</strong> below. CineFlix will verify your
            key live against TMDB, save it locally in your browser, and immediately launch the
            catalog.
          </p>
        </div>

        {/* Interactive BYOK Input Form */}
        <form
          onSubmit={handleByokSubmit}
          className="p-5 sm:p-6 rounded-xl bg-[#0A0A0E] border border-white/10 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="byok-tmdb-input"
              className="text-xs font-semibold uppercase tracking-wider text-zinc-300"
            >
              TMDB API Key (v3) or Read Access Token (v4)
            </label>
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#E50914] hover:underline inline-flex items-center gap-1"
            >
              <span>Get a Free Key on TMDB</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative flex items-center">
            <input
              id="byok-tmdb-input"
              type={showSecret ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setValidationError(null);
              }}
              placeholder="Paste your 32-char API Key or eyJ... Read Access Token"
              autoFocus
              className="w-full bg-[#121218] border border-white/15 focus:border-[#E50914] rounded-xl pl-4 pr-11 py-3.5 text-sm text-white font-mono-tabular placeholder-zinc-500 focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowSecret((prev) => !prev)}
              aria-label={showSecret ? 'Hide API key' : 'Show API key'}
              className="absolute right-3 p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {validationError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-950/60 border border-red-500/30 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {validationSuccess && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>TMDB key verified! Loading CineFlix catalog...</span>
            </div>
          )}

          <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={validating}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#E50914] hover:bg-[#F40612] disabled:opacity-50 text-sm font-semibold text-white shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Key with TMDB...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Continue to CineFlix</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {keyInput && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>Stored locally in your browser · Never sent to third-party servers</span>
            </div>
          </div>
        </form>

        {/* Quick 3-Step Instructions */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            How to Get a Free TMDB Key in 30 Seconds
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-300">
            <div className="p-3.5 rounded-xl bg-[#16161D] border border-white/[0.06]">
              <span className="font-mono-tabular font-bold text-[#E50914]">01.</span>{' '}
              Sign in or create a free account at{' '}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline hover:text-[#E50914]"
              >
                themoviedb.org/settings/api
              </a>
              .
            </div>
            <div className="p-3.5 rounded-xl bg-[#16161D] border border-white/[0.06]">
              <span className="font-mono-tabular font-bold text-[#E50914]">02.</span>{' '}
              Copy either your <strong>API Read Access Token</strong> or <strong>API Key</strong>.
            </div>
            <div className="p-3.5 rounded-xl bg-[#16161D] border border-white/[0.06]">
              <span className="font-mono-tabular font-bold text-[#E50914]">03.</span>{' '}
              Paste it above and click <strong>Verify &amp; Continue</strong> (or set{' '}
              <code className="font-mono-tabular text-zinc-200">VITE_TMDB_ACCESS_TOKEN</code> in{' '}
              <code className="font-mono-tabular text-zinc-200">.env</code>).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
