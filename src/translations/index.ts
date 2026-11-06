import { en } from './en'
import { de } from './de'

export const LANGUAGES = ['en', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

type DeepStringify<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]> }
export type TranslationKeys = DeepStringify<typeof en>

export const translations: Record<Language, TranslationKeys> = { en, de }
