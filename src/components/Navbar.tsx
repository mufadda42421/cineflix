import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, LogIn, Menu, Search, User as UserIcon, X } from 'lucide-react';
import { useCineFlix } from '../context/CineFlixContext';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, watchlist, openProfileModal, openByokModal } = useCineFlix();

  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(location.pathname === '/search');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (location.pathname === '/search') {
      setSearchOpen(true);
      const q = searchParams.get('q') || '';
      setSearchQuery(q);
    }
    setMobileMenuOpen(false);
  }, [location.pathname, searchParams]);

  const handleToggleSearch = () => {
    if (!searchOpen) {
      setSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } else if (!searchQuery.trim() && location.pathname !== '/search') {
      setSearchOpen(false);
    } else {
      navigate('/search');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim()) {
      navigate(`/search?q=${encodeURIComponent(val)}`, {
        replace: location.pathname === '/search',
      });
    } else if (location.pathname === '/search') {
      navigate('/search', { replace: true });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Movies', path: '/movies' },
    { label: 'TV Shows', path: '/tv' },
    { label: 'Trending', path: '/trending' },
    {
      label: watchlist.length > 0 ? `My List (${watchlist.length})` : 'My List',
      path: '/my-list',
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const avatarUrl = userProfile?.photoURL || user?.photoURL || '';
  const displayName =
    userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Profile';

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-colors duration-200 ${
        isScrolled || mobileMenuOpen || location.pathname !== '/'
          ? 'bg-[#080808]/95 backdrop-blur-md border-b border-white/[0.08]'
          : 'bg-gradient-to-b from-[#080808]/90 via-[#080808]/50 to-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8 px-6 md:px-12 h-16 md:h-[72px]">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-2xl md:text-[26px] font-extrabold tracking-tight text-[#E50914] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E50914]"
          aria-label="CineFlix Home"
        >
          CINEFLIX
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          className="hidden md:flex items-center gap-7 text-sm font-medium"
          aria-label="Primary Navigation"
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative py-1 transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute bottom-0 inset-x-0 h-[2px] bg-[#E50914] rounded-full"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Search, User Account & Mobile Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            {searchOpen ? (
              <div className="flex items-center bg-[#141418]/95 border border-white/15 rounded-lg px-3 py-1.5 w-44 sm:w-56 md:w-64 focus-within:border-[#E50914] transition-colors">
                <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Titles, people, genres..."
                  aria-label="Search movies, TV shows, and people"
                  className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                      if (location.pathname === '/search') {
                        navigate('/search', { replace: true });
                      }
                    }}
                    aria-label="Clear search query"
                    className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    aria-label="Close search bar"
                    className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleToggleSearch}
                aria-label="Open search"
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
            )}
          </form>

          {/* BYOK / API Key Trigger Button */}
          <button
            type="button"
            onClick={openByokModal}
            aria-label="Open Bring Your Own Key settings"
            title="Configure TMDB API Key (BYOK)"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-[#E50914]/20 hover:border-[#E50914]/40 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#E50914]" />
            <span className="hidden sm:inline">API Key</span>
          </button>

          {/* User Profile / Sign-In Trigger */}
          {user ? (
            <button
              type="button"
              onClick={openProfileModal}
              aria-label="Open profile and account settings"
              className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-zinc-300" />
                )}
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate">{displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openProfileModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E50914] hover:bg-[#F40612] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 text-zinc-300 hover:text-white rounded-lg bg-white/[0.06] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          className="md:hidden bg-[#0C0C0F] border-b border-white/10 px-6 py-4 space-y-1"
          aria-label="Mobile Navigation"
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#E50914]/15 text-white font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              openByokModal();
            }}
            className="w-full text-left flex items-center gap-2.5 py-2.5 px-3 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-[#E50914]" />
            <span>TMDB API Key (BYOK)</span>
          </button>
        </nav>
      )}
    </header>
  );
};
