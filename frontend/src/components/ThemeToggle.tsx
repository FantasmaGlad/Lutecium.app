import { useState } from 'react'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import './ThemeToggle.css'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme())

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
    >
      {theme === 'dark' ? '○' : '●'}
    </button>
  )
}
