import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom sait ouvrir de vrais WebSocket : sans ce remplaçant, chaque test qui
// monte la coquille de l'élève tenterait une connexion vers un serveur absent,
// puis des reconnexions en fond. Assigné, et non posé par `vi.stubGlobal`, pour
// survivre aux `vi.unstubAllGlobals()` des tests qui posent le leur.
class SonnetteMuette {
  onopen = null
  onmessage = null
  onclose = null
  send() {}
  close() {}
}
globalThis.WebSocket = SonnetteMuette as unknown as typeof WebSocket

// Sans `test.globals: true`, @testing-library/react ne trouve pas de global
// `afterEach` et n'enregistre pas son nettoyage automatique : chaque `render`
// laisserait son DOM en place pour le test suivant. On l'enregistre donc ici.
afterEach(() => {
  cleanup()
})
