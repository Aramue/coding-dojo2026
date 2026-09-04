import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
  server: {
    proxy: {
      // Les routes de l'API (T8) sont montées à la racine (/session, /parcours,
      // /tentative), sans préfixe : sans la réécriture, le proxy transmettrait
      // /api/session tel quel et FastAPI répondrait 404.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (chemin) => chemin.replace(/^\/api/, ''),
      },
    },
  },
})
