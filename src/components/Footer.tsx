import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';

export const Footer: React.FC = () => {
  const [activeInfoModal, setActiveInfoModal] = useState<'about' | 'privacy' | 'terms' | null>(
    null
  );

  return (
    <footer className="bg-[#060608] border-t border-white/[0.08] mt-20">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/[0.06]">
          <div className="md:col-span-5 space-y-3">
            <Link
              to="/"
              className="font-display text-2xl font-extrabold tracking-tight text-[#E50914] inline-block"
            >
              CINEFLIX
            </Link>
            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              A cinematic movie and TV series discovery experience with high-definition trailers,
              personalized genre affinity recommendations, and real-time multi-search.
            </p>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Browse Catalog
            </h3>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/movies" className="hover:text-white transition-colors">
                  Movies
                </Link>
              </li>
              <li>
                <Link to="/tv" className="hover:text-white transition-colors">
                  TV Shows
                </Link>
              </li>
              <li>
                <Link to="/trending" className="hover:text-white transition-colors">
                  Trending Now
                </Link>
              </li>
              <li>
                <Link to="/my-list" className="hover:text-white transition-colors">
                  My List
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Information &amp; Attribution
            </h3>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal('about')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  About CineFlix
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal('privacy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveInfoModal('terms')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Terms of Use
                </button>
              </li>
              <li>
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                >
                  TMDB Data Attribution
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <p>
            &copy; {new Date().getFullYear()} CineFlix Discovery Platform. All rights reserved.
          </p>
          <p className="max-w-xl text-zinc-500">
            This product uses the TMDB API but is not endorsed or certified by TMDB. Trailers are
            streamed via official YouTube embeds.
          </p>
        </div>
      </div>

      {/* Information Modal for About / Privacy / Terms */}
      {activeInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveInfoModal(null)}
        >
          <div
            className="bg-[#121216] border border-white/10 rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {activeInfoModal === 'about' && 'About CineFlix'}
                {activeInfoModal === 'privacy' && 'Privacy Policy'}
                {activeInfoModal === 'terms' && 'Terms of Use'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                aria-label="Close modal"
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeInfoModal === 'about' && (
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">
                <p>
                  CineFlix is a movie and television discovery and trailer platform powered by live
                  metadata from The Movie Database (TMDB).
                </p>
                <p>
                  Our discovery engine prioritizes official high-definition (4K/1080p) trailers and
                  adapts recommendations based on the genres you explore and save to your personal
                  watchlist.
                </p>
              </div>
            )}

            {activeInfoModal === 'privacy' && (
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">
                <p>
                  CineFlix stores your <strong>My List</strong> watchlist and genre preferences
                  exclusively in your browser&apos;s local storage (<code className="font-mono-tabular text-xs">localStorage</code>).
                </p>
                <p>
                  No personal profile data or viewing history is transmitted to external analytics
                  servers. Search queries and catalog requests are sent directly to the official
                  TMDB API.
                </p>
              </div>
            )}

            {activeInfoModal === 'terms' && (
              <div className="text-sm text-zinc-300 space-y-3 leading-relaxed">
                <p>
                  CineFlix is a metadata discovery and official trailer viewing application. It
                  does not host or stream unlicensed full-length movies or television episodes.
                </p>
                <p>
                  All film posters, backdrops, synopses, and cast credits are provided via the
                  official TMDB API and remain the property of their respective copyright holders.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#E50914] hover:bg-[#F40612] rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
