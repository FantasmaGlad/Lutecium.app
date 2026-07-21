import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from './Wordmark'
import { ThemeToggle } from './ThemeToggle'
import { NavDrawer } from './NavDrawer'
import { AccountMenu } from './AccountMenu'
import './Header.css'

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="header">
      <button
        type="button"
        className="header__burger"
        aria-label="Ouvrir le menu"
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
        <ThemeToggle />
        <AccountMenu />
      </div>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  )
}
