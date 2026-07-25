import { useState } from 'react'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import './ErrorCard.css'

interface ErrorCardProps {
  message: string
  details?: string
  onRetry: () => void
  onChangeUrl: () => void
}

export function ErrorCard({ message, details, onRetry, onChangeUrl }: ErrorCardProps) {
  const { t } = useLanguage()
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="error-card" role="alert">
      <p className="error-card__message">{message}</p>
      <div className="error-card__actions">
        <button type="button" className="error-card__action" onClick={onRetry}>
          {t.errorCard.retry}
        </button>
        <button type="button" className="error-card__action" onClick={onChangeUrl}>
          {t.errorCard.changeUrl}
        </button>
      </div>
      {details && (
        <>
          <button type="button" className="error-card__details-toggle" onClick={() => setShowDetails((v) => !v)}>
            {t.errorCard.details}
          </button>
          {showDetails && <p className="error-card__details">{details}</p>}
        </>
      )}
    </div>
  )
}
