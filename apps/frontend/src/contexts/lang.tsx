'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { type Lang, getTranslations, type TranslationKey } from '@/lib/i18n'

type LangContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const LangContext = createContext<LangContextType>({
  lang: 'ru',
  setLang: () => {},
  t: (key) => key,
})

export function LangProvider({ children, initialLang = 'ru' }: { children: React.ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'ru' || stored === 'en') {
      setLangState(stored)
      document.cookie = `lang=${stored}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
    document.cookie = `lang=${l}; path=/; max-age=31536000; SameSite=Lax`
    document.documentElement.lang = l
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, t: getTranslations(lang) }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
