import { useState } from 'react'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './ThemeToggle.css'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const { t } = useLanguage()

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
      aria-label={theme === 'dark' ? t.header.themeToLight : t.header.themeToDark}
    >
      {theme === 'dark' ? '○' : '●'}
    </button>
  )
}
