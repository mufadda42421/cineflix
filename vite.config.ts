import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const tmdbToken =
    env.VITE_TMDB_ACCESS_TOKEN ||
    env.TMDB_ACCESS_TOKEN ||
    process.env.VITE_TMDB_ACCESS_TOKEN ||
    process.env.TMDB_ACCESS_TOKEN ||
    '';
  const tmdbApiKey =
    env.VITE_TMDB_API_KEY ||
    env.TMDB_API_KEY ||
    process.env.VITE_TMDB_API_KEY ||
    process.env.TMDB_API_KEY ||
    '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_TMDB_ACCESS_TOKEN': JSON.stringify(tmdbToken),
      'import.meta.env.VITE_TMDB_API_KEY': JSON.stringify(tmdbApiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
