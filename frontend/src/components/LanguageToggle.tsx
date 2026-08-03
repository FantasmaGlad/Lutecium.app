import { useLanguage } from '../lib/i18n/LanguageContext'
import './LanguageToggle.css'

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()

  function toggle() {
    setLang(lang === 'fr' ? 'en' : 'fr')
  }

  return (
    <button
      type="button"
      className="language-toggle"
      onClick={toggle}
      aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
    >
      {lang === 'fr' ? 'FR' : 'EN'}
    </button>
  )
}
