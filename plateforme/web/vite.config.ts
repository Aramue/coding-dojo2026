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
        // La sonnette du quiz est un WebSocket : sans `ws`, le proxy de
        // développement refuse la mise à niveau et le quiz retombe sur la
        // relecture chaque seconde — ce qui marche, mais masque le vrai chemin.
        ws: true,
        rewrite: (chemin) => chemin.replace(/^\/api/, ''),
      },
    },
  },
})
