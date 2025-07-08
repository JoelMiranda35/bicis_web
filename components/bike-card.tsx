"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bike } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface BikeCardProps {
  bike: {
    id: string
    category: string
    size: string
    image_url?: string | null // OPCIONAL
    [key: string]: any
  }
  showSize?: boolean
  language: string
}

export function BikeCard({ bike, showSize = true, language }: BikeCardProps) {
  const { t } = useLanguage()

  const title = bike[`title_${language}`] || "Sin título"
  const subtitle = bike[`subtitle_${language}`] || "Sin subtítulo"

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "ROAD":
        return "bg-blue-100 text-blue-800"
      case "MTB":
        return "bg-green-100 text-green-800"
      case "CITY_BIKE":
        return "bg-yellow-100 text-yellow-800"
      case "E_CITY_BIKE":
        return "bg-purple-100 text-purple-800"
      case "E_MTB":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryName = (category: string) => {
    switch (category) {
      case "ROAD":
        return t("road")
      case "MTB":
        return t("mtb")
      case "CITY_BIKE":
        return t("cityBike")
      case "E_CITY_BIKE":
        return t("eCityBike")
      case "E_MTB":
        return t("eMtb")
      default:
        return category
    }
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="aspect-video relative bg-gray-100">
          {bike.image_url ? (
            <Image
              src={bike.image_url}
              alt={title}
              fill
              className="object-cover"
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
              <Bike className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-2">{title}</CardTitle>
        <p className="text-sm text-gray-600 mb-3">{subtitle}</p>
        <div className="flex gap-2">
          <Badge className={getCategoryColor(bike.category)}>{getCategoryName(bike.category)}</Badge>
          {showSize && (
            <Badge variant="outline">
              {t("size")} {bike.size}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
