export type Lang = 'fr' | 'en'

const STORAGE_KEY = 'lutecium-lang'

function browserLang(): Lang {
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

export function getLanguage(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'fr' || stored === 'en') return stored
  return browserLang()
}

export function setLanguage(lang: Lang) {
  localStorage.setItem(STORAGE_KEY, lang)
}
