import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sans `test.globals: true`, @testing-library/react ne trouve pas de global
// `afterEach` et n'enregistre pas son nettoyage automatique : chaque `render`
// laisserait son DOM en place pour le test suivant. On l'enregistre donc ici.
afterEach(() => {
  cleanup()
})
