import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Card from './Card.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Card />
  </StrictMode>,
)
