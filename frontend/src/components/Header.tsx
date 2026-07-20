import { Wordmark } from './Wordmark'
import { ThemeToggle } from './ThemeToggle'
import './Header.css'

export function Header() {
  return (
    <header className="header">
      <button type="button" className="header__burger" aria-label="Ouvrir le menu">
        <span />
        <span />
        <span />
      </button>
      <a href="/" className="header__brand">
        <Wordmark />
      </a>
      <div className="header__actions">
        <ThemeToggle />
        <button type="button" className="header__account">Se connecter</button>
      </div>
    </header>
  )
}
