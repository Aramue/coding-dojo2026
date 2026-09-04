import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import './ui/tokens.css'
import './ui/base.css'
import './ui/app.css'

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
