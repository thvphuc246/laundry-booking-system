import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles.css'
import { App } from './App'
import { ConfirmProvider } from './components/ConfirmDialog'

const root = document.getElementById('root')
if (!root) throw new Error('#root element is missing')

createRoot(root).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </StrictMode>,
)
