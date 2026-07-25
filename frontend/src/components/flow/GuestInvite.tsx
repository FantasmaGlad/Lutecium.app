import { Link } from 'react-router-dom'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import './GuestInvite.css'

export function GuestInvite() {
  const { t } = useLanguage()

  return (
    <div className="guest-invite">
      <p className="guest-invite__message">{t.guestInvite.message}</p>
      <div className="guest-invite__actions">
        <Link to="/register" className="guest-invite__button guest-invite__button--primary">
          {t.guestInvite.createAccount}
        </Link>
        <Link to="/login" className="guest-invite__button">
          {t.guestInvite.login}
        </Link>
      </div>
    </div>
  )
}
