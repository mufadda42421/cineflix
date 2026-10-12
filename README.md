# CineFlix — Movie & TV Discovery Platform

CineFlix is a responsive movie and television discovery web application built with React, TypeScript, Tailwind CSS, and the official **TMDB (The Movie Database) API**.

---

## Features

- **Cinematic Hero Spotlight**: Auto-rotating featured backdrop banner with pause-on-interaction, rating, release year, genres, and instant trailer playback.
- **11 Live TMDB Content Carousels**:
  - Trending Now (`/trending/all/day`)
  - Recommended For You (personalized via your genre affinity profile)
  - Popular Movies (`/movie/popular`)
  - Top Rated Movies (`/movie/top_rated`)
  - Upcoming Movies (`/movie/upcoming`)
  - Popular TV Shows (`/tv/popular`)
  - Top Rated TV Shows (`/tv/top_rated`)
  - Action & Adventure, Sci-Fi, Comedy, and Horror (`/discover/movie`)
- **High-Definition Trailer Player**: Fetches official video feeds (`/movie/{id}/videos`, `/tv/{id}/videos`) and prioritizes official 4K UHD / 1080p HD YouTube trailers in a responsive modal with keyboard (`ESC`) support.
- **Live Debounced Multi-Search**: Searches across movies, TV series, and cast/crew (`/search/multi`) with a 300ms debounce, media-type filtering, genre filtering, and personalized genre-affinity ranking.
- **Comprehensive Title Details**: Displays high-resolution backdrops, synopsis, runtime/season info, directors/creators, production studios, cast member headshots (`/credits`), official trailers, and similar/recommended titles (`/similar`, `/recommendations`).
- **My List Watchlist**: Add or remove movies and TV shows with automatic persistence in `localStorage`.

---

## How to Obtain and Configure a TMDB API Token

1. **Create a Free TMDB Account**:
   Visit [https://www.themoviedb.org/signup](https://www.themoviedb.org/signup) and verify your email address.
2. **Generate an API Read Access Token**:
   Navigate to [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) and request a free developer API key.
3. **Copy Your Bearer Token**:
   Under your API settings, copy the **API Read Access Token (v4 auth)** (starts with `eyJ...`).
4. **Configure Your Environment Variable**:
   - **In Google AI Studio**: Open the **Secrets** panel and add:
     ```env
     VITE_TMDB_ACCESS_TOKEN="your_tmdb_read_access_token_here"
     ```
   - **Local Development**: Copy `.env.example` to `.env` and set `VITE_TMDB_ACCESS_TOKEN`. (You can also optionally provide a 32-character v3 API key in `VITE_TMDB_API_KEY`).

---

## Local Setup & Launch Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Create a `.env` file in the project root:
   ```env
   VITE_TMDB_ACCESS_TOKEN="your_tmdb_bearer_token"
   ```
3. **Start the development server**:
   ```bash
   npm run dev
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```

---

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
