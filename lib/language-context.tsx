"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { translations, type Language } from "./translations"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("es")

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("altea-language") as Language
    if (savedLanguage && ["es", "en", "nl"].includes(savedLanguage)) {
      setLanguage(savedLanguage)
    }
  }, [])

  // Save language to localStorage when it changes
  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("altea-language", lang)
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    // Implementación mejorada para manejar claves anidadas
    const keys = key.split('.')
    let translation: any = translations[language]
    
    for (const k of keys) {
      translation = translation?.[k]
      if (translation === undefined) {
        // Fallback a español si no se encuentra la traducción
        translation = translations.es
        for (const k of keys) {
          translation = translation?.[k]
          if (translation === undefined) return key // Si no existe, devolver la clave
        }
        break
      }
    }

    // Reemplazar parámetros si existen
    if (params && typeof translation === 'string') {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{${paramKey}}`, String(value))
      })
    }

    return translation || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}