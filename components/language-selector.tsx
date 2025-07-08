"use client"

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { useLanguage } from "@/lib/language-context"
import { Globe } from "lucide-react"

// Mapeo de idioma a código ISO para imágenes de bandera
const flagMap: Record<string, string> = {
  es: "es",
  en: "gb", // Para Reino Unido usamos "gb"
  nl: "nl",
}

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-600" />
      <Select value={language} onValueChange={setLanguage}>
        <SelectTrigger className="flex items-center w-24 h-8 text-sm border rounded px-2 bg-white">
          <img
            src={`https://flagcdn.com/w20/${flagMap[language] ?? "us"}.png`}
            alt={`${language} flag`}
            className="w-5 h-4 mr-1 object-cover"
            draggable={false}
          />
          <span>{language.toUpperCase()}</span>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(flagMap).map(([langCode, countryCode]) => (
            <SelectItem key={langCode} value={langCode}>
              <img
                src={`https://flagcdn.com/w20/${countryCode}.png`}
                alt={`${langCode} flag`}
                className="w-5 h-4 mr-2 object-cover inline"
                draggable={false}
              />
              {langCode.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
