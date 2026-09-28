import { useCallback, useState } from 'react'
import type { ThemeChoice } from './types'

const STORAGE_KEY = 'theme'

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function applyTheme(theme: ThemeChoice) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    return
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme)
  const choose = useCallback((next: ThemeChoice) => {
    setTheme(next)
    applyTheme(next)
  }, [])
  return [theme, choose] as const
}
