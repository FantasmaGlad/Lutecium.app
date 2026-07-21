import { useEffect, useRef, useState } from 'react'
import './UrlCard.css'

const SUPPORTED_SITES = 'YouTube, TikTok, Instagram, X, +1000 autres'

function looksLikeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

interface UrlCardProps {
  analyzing: boolean
  error: string | null
  onSubmitUrl: (url: string) => void
  initialUrl?: string
}

export function UrlCard({ analyzing, error, onSubmitUrl, initialUrl }: UrlCardProps) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSubmitted = useRef<string | null>(null)

  useEffect(() => {
    if (initialUrl) {
      lastSubmitted.current = null
      setUrl(initialUrl)
    }
    // volontairement déclenché seulement quand initialUrl change (reprise post-inscription)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = url.trim()
    if (!looksLikeUrl(trimmed) || trimmed === lastSubmitted.current) return
    debounceRef.current = setTimeout(() => {
      lastSubmitted.current = trimmed
      onSubmitUrl(trimmed)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch {
      // presse-papier indisponible (permission refusée, contexte non sécurisé) : rien à faire
    }
  }

  return (
    <div className="url-card">
      <div className={`url-card__input-row${analyzing ? ' url-card__input-row--analyzing' : ''}`}>
        <input
          type="url"
          inputMode="url"
          className="url-card__input"
          placeholder="colle un lien ici…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Lien de la vidéo à télécharger"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'url-card-error' : undefined}
        />
        <button
          type="button"
          className="url-card__paste"
          onClick={pasteFromClipboard}
          aria-label="Coller depuis le presse-papier"
        >
          ⎘
        </button>
      </div>
      {analyzing && (
        <p className="url-card__status" aria-live="polite">
          analyse en cours<span className="url-card__dots" aria-hidden="true">…</span>
        </p>
      )}
      {error && !analyzing && (
        <p id="url-card-error" className="url-card__error" role="alert">
          {error}
        </p>
      )}
      {!analyzing && !error && <p className="url-card__supported">{SUPPORTED_SITES}</p>}
    </div>
  )
}
