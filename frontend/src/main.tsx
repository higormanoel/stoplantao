import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useGame } from './store/gameStore'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/screens.css'

// debug no console: window.__game.getState()
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
