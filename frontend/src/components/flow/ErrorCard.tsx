import { useState } from 'react'
import './ErrorCard.css'

interface ErrorCardProps {
  message: string
  details?: string
  onRetry: () => void
  onChangeUrl: () => void
}

export function ErrorCard({ message, details, onRetry, onChangeUrl }: ErrorCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="error-card" role="alert">
      <p className="error-card__message">{message}</p>
      <div className="error-card__actions">
        <button type="button" className="error-card__action" onClick={onRetry}>
          réessayer
        </button>
        <button type="button" className="error-card__action" onClick={onChangeUrl}>
          changer d'URL
        </button>
      </div>
      {details && (
        <>
          <button type="button" className="error-card__details-toggle" onClick={() => setShowDetails((v) => !v)}>
            détails
          </button>
          {showDetails && <p className="error-card__details">{details}</p>}
        </>
      )}
    </div>
  )
}
