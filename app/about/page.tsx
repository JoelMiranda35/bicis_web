"use client"

import Image from "next/image"
import { MapPin, Users, Award, Heart } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export default function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-green-600 to-green-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">{t("aboutUs")}</h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto">{t("aboutSubtitle")}</p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">{t("ourStory")}</h2>
              <div className="space-y-4 text-gray-600">
                <p>{t("storyParagraph1")}</p>
                <p>{t("storyParagraph2")}</p>
                <p>{t("storyParagraph3")}</p>
              </div>
            </div>
            <div className="relative">
              <Image
                src="/images/logo.jpg"
                alt="Altea Bike Shop"
                width={500}
                height={500}
                className="rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("ourValues")}</h2>
            <p className="text-lg text-gray-600">{t("valuesSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("quality")}</h3>
              <p className="text-gray-600">{t("qualityDesc")}</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("service")}</h3>
              <p className="text-gray-600">{t("serviceDesc")}</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("local")}</h3>
              <p className="text-gray-600">{t("localDesc")}</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("passion")}</h3>
              <p className="text-gray-600">{t("passionDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("ourTeam")}</h2>
            <p className="text-lg text-gray-600">{t("teamSubtitle")}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-8 text-center">
            <p className="text-lg text-gray-700 mb-4">"{t("teamQuote")}"</p>
            <p className="text-gray-600">{t("teamMessage")}</p>
          </div>
        </div>
      </section>

      {/* Location Section */}
<section className="py-16 bg-gray-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("ourLocation")}</h2>
      <p className="text-lg text-gray-600">{t("locationSubtitle")}</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        <h3 className="text-xl font-semibold mb-4">{t("howToGetHere")}</h3>
        <div className="space-y-4 text-gray-600">
          <p>{t("locationDesc1")}</p>
          <p>{t("locationDesc2")}</p>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-green-600 mr-2" />
            <span>Calle la Tella 2, Altea 03590, Alicante</span>
          </div>
        </div>
      </div>

      {/* Contenedor del mapa con enlace */}
      <a 
        href="https://www.google.com/maps/place/Calle+la+Tella,+2,+03590+Altea,+Alicante/" 
        target="_blank" 
        rel="noopener noreferrer"
        className="relative group overflow-hidden rounded-lg shadow-lg"
      >
        {/* Imagen estática del mapa - Reemplaza con tu imagen */}
        <Image
          src="/images/Alteamap.jpg" // Ruta a tu imagen del mapa
          alt="Ubicación de Altea Bike Shop en mapa"
          width={600}
          height={400}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
        {/* Overlay para efecto hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
          <span className="bg-white px-4 py-2 rounded-full font-medium text-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Ver en Google Maps →
          </span>
        </div>
      </a>
    </div>
  </div>
</section>
    </div>
  )
}
