/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ByokKeyModal } from './components/ByokKeyModal';
import { DetailsModal } from './components/DetailsModal';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ProfileModal } from './components/ProfileModal';
import { HeroSkeleton } from './components/SkeletonLoader';
import { TrailerModal } from './components/TrailerModal';
import { WatchPlayerModal } from './components/WatchPlayerModal';
import { CineFlixProvider } from './context/CineFlixContext';

const HomePage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage }))
);
const BrowsePage = lazy(() =>
  import('./pages/BrowsePage').then((m) => ({ default: m.BrowsePage }))
);
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage }))
);
const MyListPage = lazy(() =>
  import('./pages/MyListPage').then((m) => ({ default: m.MyListPage }))
);
const TitleDetailsPage = lazy(() =>
  import('./pages/TitleDetailsPage').then((m) => ({ default: m.TitleDetailsPage }))
);

export default function App() {
  return (
    <BrowserRouter>
      <CineFlixProvider>
        <div className="min-h-screen flex flex-col bg-[#080808] text-[#F4F4F5] selection:bg-[#E50914] selection:text-white">
          <Navbar />

          <div className="flex-1">
            <Suspense fallback={<HeroSkeleton />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/movies" element={<BrowsePage mode="movie" />} />
                <Route path="/tv" element={<BrowsePage mode="tv" />} />
                <Route path="/trending" element={<BrowsePage mode="trending" />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/my-list" element={<MyListPage />} />
                <Route path="/title/:mediaType/:id" element={<TitleDetailsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>

          <DetailsModal />
          <TrailerModal />
          <WatchPlayerModal />
          <ProfileModal />
          <ByokKeyModal />
          <Footer />
        </div>
      </CineFlixProvider>
    </BrowserRouter>
  );
}
