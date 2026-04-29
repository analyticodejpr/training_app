import { useState, useEffect } from 'react'

const STORAGE_KEY = 'zone-theme'

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  // Apply on first mount in case localStorage had dark saved
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  return [theme, setThemeState]
}
