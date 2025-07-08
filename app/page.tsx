"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BikeCard } from "@/components/bike-card"
import { supabase } from "@/lib/supabase"
import { Bike, Shield, Clock } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface Bike {
  id: string
  available: boolean
  category: string
  size: string
  [key: string]: any
}

export default function HomePage() {
  const [recommendedBikes, setRecommendedBikes] = useState<Bike[]>([])
  const { t, language } = useLanguage()

  useEffect(() => {
    fetchRecommendedBikes()
  }, [language]) // Reactiva cuando cambia el idioma

  const fetchRecommendedBikes = async () => {
    const { data, error } = await supabase
      .from("bikes")
      .select("*")
      .eq("available", true)
      .limit(6)

    if (error) {
      console.error("Error fetching bikes:", error)
    }

    if (data) {
      setRecommendedBikes(data)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0">
          <Image src="/images/hero-bg.jpg" alt="Ciclistas en carretera" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black bg-opacity-40" />
        </div>

        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">{t("exploreAltea")}</h1>
          <p className="text-xl md:text-2xl mb-8">{t("rentBestBikes")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-green-600 hover:bg-green-700">
              <Link href="/reserve">{t("reserveNow")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-white text-black hover:bg-gray-100">
              <Link href="/catalog">{t("viewCatalog")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("whyChoose")}</h2>
            <p className="text-lg text-gray-600">{t("yearsExperience")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bike className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("premiumBikes")}</h3>
              <p className="text-gray-600">{t("renewedFleet")}</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("insuranceIncluded")}</h3>
              <p className="text-gray-600">{t("completeProtection")}</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("service24")}</h3>
              <p className="text-gray-600">{t("technicalAssistance")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended Bikes Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("recommendedBikes")}</h2>
            <p className="text-lg text-gray-600">{t("popularBikes")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {recommendedBikes.map((bike) => (
              <BikeCard key={bike.id} bike={bike} language={language} />
            ))}
          </div>

          <div className="text-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/catalog">{t("viewAllBikes")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
