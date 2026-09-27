import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/preparation.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/**/*.{ts,tsx}'],
      // Exclus : le worker (il ne tourne que dans un vrai navigateur, pas sous
      // jsdom), le point d'entrée, et les fichiers de types qui ne contiennent
      // aucune instruction exécutable.
      exclude: ['src/main.tsx', 'src/execution/worker.ts', 'src/**/types.ts'],
      thresholds: {
        // 100 partout depuis le 27 septembre 2026. Le plancher global etait a
        // 78 : il valait pour des composants qu'on ne testait que sur leurs
        // chemins heureux. Ce qui manquait n'etait pas du remplissage — les
        // accords, les messages de repli, les courses au demontage et les
        // verdicts rouges sont exactement ce qui se voit en seance.
        //
        // Les quelques lignes qu'aucun test ne peut atteindre portent un
        // `/* v8 ignore next */` et disent pourquoi : une fabrique de Worker
        // Pyodide, qui ne demarre pas sous jsdom, et des gardes que TypeScript
        // exige sur des cas que le type a deja exclus.
        //
        // C'est un cliquet : il ne redescend pas.
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
