import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
  server: {
    // Derriere Docker, deux choses ne marchent pas d'elles-memes.
    //
    // Le SONDAGE : un montage depuis Windows ne transmet pas les evenements
    // d'inotify au conteneur. Sans lui la page se charge, et plus rien ne
    // bouge quand on enregistre — sans le moindre message.
    //
    // Le PORT DU CLIENT : le navigateur atteint Vite a travers Caddy, sur le
    // port 80. Le client de rechargement a chaud, lui, viserait 5173 par
    // defaut et n'ouvrirait jamais son websocket.
    //
    // Les deux sont conditionnes : sur l'hote, `pnpm dev` garde les
    // evenements natifs, qui sont gratuits.
    ...(process.env.DOJO_DOCKER
      ? { watch: { usePolling: true, interval: 300 }, hmr: { clientPort: 80 } }
      : {}),
    proxy: {
      // Ce proxy ne sert QUE sur l'hôte : dans Docker, c'est Caddy qui route
      // /api vers le conteneur de l'API, et Vite ne voit jamais ces chemins.
      //
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
