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
        // Logique pure : rien ne justifie une ligne non couverte.
        'src/validation/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/routage.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/ui/texte.tsx': { statements: 100, branches: 100, functions: 100, lines: 100 },
        // Plancher global : la mesure du 4 septembre 2026 apres la coquille,
        // arrondie a l'entier inferieur. C'est un cliquet, pas un objectif —
        // il ne descend jamais. Les composants sont testes sur leur
        // comportement, pas ligne a ligne : viser 100 % ici se gagnerait en
        // ecrivant des tests qui montent un composant et n'affirment rien.
        statements: 78,
        branches: 78,
        functions: 78,
        lines: 78,
      },
    },
  },
})
