"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface AccessoryCardProps {
  accessory: {
    id: string
    type: string
    price?: number
    image_url?: string | null
    [key: string]: any
  }
  showPrice?: boolean
}

export function AccessoryCard({ accessory, showPrice = true }: AccessoryCardProps) {
  const { t, language } = useLanguage()

  const translatedName = accessory[`name_${language}`] || "Sin nombre"

  const getTypeColor = (type: string) => {
    switch (type) {
      case "pedal":
        return "bg-blue-100 text-blue-800"
      case "helmet":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeName = (type: string) => {
  switch (type) {
    case "pedal":
      return language === "es" ? "Pedal" : language === "en" ? "Pedal" : "Pedaal"
    case "helmet":
      return language === "es" ? "Casco" : language === "en" ? "Helmet" : "Helm"
    case "other":
      return language === "es" ? "Otros" : language === "en" ? "Other" : "Overig"
    default:
      return type
  }
}


  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="relative bg-white h-64">
          {accessory.image_url ? (
            <Image
              src={accessory.image_url}
              alt={translatedName}
              fill
              className="object-contain p-2"
              onError={(e) => {
                const target = e.currentTarget
                target.style.display = "none"
                const fallback = target.parentElement?.querySelector(".fallback-icon")
                if (fallback) {
                  (fallback as HTMLElement).style.display = "flex"
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center fallback-icon flex">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-2">{translatedName}</CardTitle>
        {showPrice && accessory.price !== undefined && (
          <p className="text-sm font-medium text-green-600 mb-3">
            {`${accessory.price} ${t("euro")} ${t("perDay")}`}
          </p>
        )}
        <div className="flex gap-2">
          <Badge className={getTypeColor(accessory.type)}>{getTypeName(accessory.type)}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
