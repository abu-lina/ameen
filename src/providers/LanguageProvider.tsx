'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LANGUAGES, translations, type Language, type TranslationKeys } from '@/translations'

const STORAGE_KEY = 'ameen-lang'
const DEFAULT_LANG: Language = 'en'

type LanguageContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function resolve(obj: unknown, path: string): string {
  let current = obj
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return path
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === 'string' ? current : path
}

function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return DEFAULT_LANG
  for (const tag of navigator.languages ?? []) {
    const code = tag.split('-')[0].toLowerCase()
    if ((LANGUAGES as readonly string[]).includes(code)) return code as Language
  }
  return DEFAULT_LANG
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANG)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (LANGUAGES as readonly string[]).includes(stored)) {
      setLanguageState(stored as Language)
    } else {
      const detected = detectLanguage()
      setLanguageState(detected)
      localStorage.setItem(STORAGE_KEY, detected)
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let text = resolve(translations[language] as unknown, key)
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{{${k}}}`, String(v))
        }
      }
      return text
    },
    [language],
  )

  return (
    <LanguageContext value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
