import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppMain from './AppMain.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppMain />
  </StrictMode>,
)
