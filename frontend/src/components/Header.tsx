import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from './Wordmark'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { NavDrawer } from './NavDrawer'
import { AccountMenu } from './AccountMenu'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './Header.css'

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <header className="header">
      <button
        type="button"
        className="header__burger"
        aria-label={t.header.openMenu}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      <Link to="/" className="header__brand">
        <Wordmark />
      </Link>
      <div className="header__actions">
        <LanguageToggle />
        <ThemeToggle />
        <AccountMenu />
      </div>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  )
}
