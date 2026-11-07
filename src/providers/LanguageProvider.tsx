'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { en } from '@/translations/en'
import { de } from '@/translations/de'

export const LANGUAGES = ['en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

const translations: Record<Language, typeof en> = { en, de }

const LANGUAGE_MAPPING: Record<string, Language> = {
  en: 'en', de: 'de',
  'en-us': 'en', 'en-gb': 'en', 'en-ca': 'en', 'en-au': 'en',
  'de-de': 'de', 'de-at': 'de', 'de-ch': 'de',
}

function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = localStorage.getItem('preferred-language')
    if (saved && LANGUAGES.includes(saved as Language)) return saved as Language
    for (const lang of (navigator.languages || [navigator.language])) {
      const normalized = lang.toLowerCase().split('-')[0]
      if (normalized in LANGUAGE_MAPPING) return LANGUAGE_MAPPING[normalized]
      if (lang.toLowerCase() in LANGUAGE_MAPPING) return LANGUAGE_MAPPING[lang.toLowerCase()]
    }
    return 'en'
  } catch { return 'en' }
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  const setLanguage = useCallback((lang: Language) => {
    if (!LANGUAGES.includes(lang)) lang = 'en'
    setLanguageState(lang)
    if (typeof window !== 'undefined') localStorage.setItem('preferred-language', lang)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const detected = detectLanguage()
    setLanguageState(detected)
    localStorage.setItem('preferred-language', detected)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = language
  }, [language])

  const t = useCallback((key: string, variables?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: unknown = translations[language] ?? translations.en
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else { return key }
    }
    let result = typeof value === 'string' ? value : key
    if (variables) {
      for (const [name, val] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), () => String(val))
      }
    }
    return result
  }, [language])

  const contextValue = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])
  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}
