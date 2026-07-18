import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import FoundryApp from './FoundryApp'
import './styles.css'
import './foundry.css'

const isFoundry = window.location.pathname.startsWith('/foundry')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isFoundry ? <FoundryApp /> : <App />}
  </StrictMode>,
)
