import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { formatBytes } from '../lib/format'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './AccountPage.css'

export function AccountPage() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  if (!user) return null

  const over = user.usage_today_bytes > user.daily_quota_bytes
  const rawPct = (user.usage_today_bytes / user.daily_quota_bytes) * 100
  // Le quota-cadeau (CDC §6.4) doit "dépasser élégamment le maximum" — la jauge peut donc
  // réellement franchir 100% (plafonnée à 130% pour rester lisible sur un dépassement extrême).
  const pct = over ? Math.min(rawPct, 130) : Math.min(rawPct, 100)

  return (
    <div className="account-page">
      <h1 className="account-page__title">{t.account.title}</h1>
      <p className="account-page__pseudo">{user.pseudo}</p>

      <div className="account-page__quota">
        <div className="account-page__quota-track">
          <motion.div
            className="account-page__quota-fill"
            data-over={over || undefined}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="account-page__quota-label">
          {formatBytes(user.usage_today_bytes)} / {formatBytes(user.daily_quota_bytes)}
        </span>
        {over && (
          <motion.p
            className="account-page__gift-message"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {t.account.giftQuotaMessage}
          </motion.p>
        )}
      </div>

      <div className="account-page__actions">
        <Link to="/changer-mot-de-passe" className="account-page__link">
          {t.account.changePassword}
        </Link>
        <Link to="/historique" className="account-page__link">
          {t.account.history}
        </Link>
        <button
          type="button"
          className="account-page__logout"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          {t.account.logout}
        </button>
      </div>
    </div>
  )
}
