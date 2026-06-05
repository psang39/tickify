import { initializeTheme } from '@/store/useThemeStore';

import { StrictMode } from 'react'
import { initializeTheme();

createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
