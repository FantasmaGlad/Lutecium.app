import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fr, en } from './translations'
import { getLanguage, setLanguage, type Lang } from '../language'

const dictionaries = { fr, en }

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: typeof fr
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLanguage())

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  function setLang(next: Lang) {
    setLanguage(next)
    setLangState(next)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage doit être utilisé dans <LanguageProvider>')
  return ctx
}
