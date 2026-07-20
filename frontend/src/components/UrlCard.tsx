import { useState } from 'react'
import './UrlCard.css'

const SUPPORTED_SITES = 'YouTube, TikTok, Instagram, X, +1000 autres'

export function UrlCard() {
  const [url, setUrl] = useState('')

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
      <div className="url-card__input-row">
        <input
          type="url"
          inputMode="url"
          className="url-card__input"
          placeholder="colle un lien ici…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Lien de la vidéo à télécharger"
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
      <p className="url-card__supported">{SUPPORTED_SITES}</p>
    </div>
  )
}
