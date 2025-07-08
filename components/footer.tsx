"use client"

import Image from "next/image"
import { MapPin, Phone, Mail, Clock } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <Image 
                src="/images/logo.jpg" 
                alt="Altea Bike Shop" 
                width={50} 
                height={50} 
                className="rounded-full" 
              />
              <span className="ml-2 text-xl font-bold">Altea Bike Shop</span>
            </div>
            <p className="text-gray-300 mb-4">{t("trustStore")}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{t("contactInfo")}</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="text-sm text-gray-300">Calle la Tella 2, Altea 03590</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                <a href="tel:+34604535972" className="text-sm text-gray-300 hover:text-white">
                  +34 604 535 972
                </a>
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                <a href="mailto:alteabikeshop@gmail.com" className="text-sm text-gray-300 hover:text-white">
                  alteabikeshop@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{t("schedule")}</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                <div className="text-sm text-gray-300">
                  <div>Lunes a Viernes: 10:00 - 18:00</div>
                  <div>Sábados: 10:00 - 14:00</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">© 2025 Altea Bike Shop. {t("allRightsReserved")}.</p>
        </div>
      </div>
    </footer>
  )
}