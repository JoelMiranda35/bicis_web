"use client"

import Image from "next/image"
import { MapPin, Phone, Mail, Clock, Star } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export function Footer() {
  const { t, language } = useLanguage()

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header con logos */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 pb-6 border-b border-gray-800">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="flex items-center">
              <Image 
                src="/images/logo.jpg" 
                alt="Altea Bike Shop" 
                width={40} 
                height={40} 
                className="rounded-full" 
              />
              <span className="ml-2 text-lg font-bold">{t("alteaBikeShop")}</span>
            </div>
            <span className="mx-4 text-gray-400">|</span>
            <div className="flex items-center">
              <Image 
                src="/images/albir-cycling-logo.jpeg" 
                alt="Albir Cycling" 
                width={40} 
                height={40} 
                className="rounded-full" 
              />
              <span className="ml-2 text-lg font-bold">{t("albirCycling")}</span>
            </div>
          </div>
          <p className="text-gray-300 text-center md:text-right">
            {t("trustStore")} - {language === 'es' ? 'Tu partner ciclista en la Costa Blanca' : 
              language === 'en' ? 'Your cycling partner in Costa Blanca' : 
              'Uw fietspartner in Costa Blanca'}
          </p>
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Altea Bike Shop */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <Image 
                src="/images/logo.jpg" 
                alt="Altea Bike Shop" 
                width={40} 
                height={40} 
                className="rounded-full" 
              />
              <h3 className="ml-2 text-lg font-semibold">{t("alteaBikeShop")}</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start">
                <MapPin className="h-4 w-4 mt-1 mr-2 flex-shrink-0" />
                <span className="text-sm text-gray-300">{t("locationAlteaAddress")}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                <a href="tel:+34604535972" className="text-sm text-gray-300 hover:text-white">
                  +34 604 535 972
                </a>
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                <a href="mailto:alteabikeshop@gmail.com" className="text-sm text-gray-300 hover:text-white">
                  alteabikeshop@gmail.com
                </a>
              </div>
              <div className="flex items-start pt-2">
                <Clock className="h-4 w-4 mt-1 mr-2 flex-shrink-0" />
                <div className="text-sm text-gray-300">
                  <div>{language === 'es' ? 'Lunes a Viernes: 10:00 - 18:00' : 
                        language === 'en' ? 'Monday to Friday: 10:00 - 18:00' : 
                        'Maandag tot Vrijdag: 10:00 - 18:00'}</div>
                  <div>{language === 'es' ? 'Sábados: 10:00 - 14:00' : 
                        language === 'en' ? 'Saturdays: 10:00 - 14:00' : 
                        'Zaterdagen: 10:00 - 14:00'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Albir Cycling */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <Image 
                src="/images/albir-cycling-logo.jpeg" 
                alt="Albir Cycling" 
                width={40} 
                height={40} 
                className="rounded-full" 
              />
              <h3 className="ml-2 text-lg font-semibold">{t("albirCycling")}</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start">
                <MapPin className="h-4 w-4 mt-1 mr-2 flex-shrink-0" />
                <span className="text-sm text-gray-300">{t("locationAlbirAddress")}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                <a href="tel:+34966864083" className="text-sm text-gray-300 hover:text-white">
                  966 864 083
                </a>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                <a href="tel:+34676421890" className="text-sm text-gray-300 hover:text-white">
                  676 421 890
                </a>
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                <a href="mailto:info@albir-cycling.com" className="text-sm text-gray-300 hover:text-white">
                  info@albir-cycling.com
                </a>
              </div>
              <div className="flex items-start pt-2">
                <Clock className="h-4 w-4 mt-1 mr-2 flex-shrink-0" />
                <div className="text-sm text-gray-300">
                  <div>{language === 'es' ? 'Lunes a Viernes: 10:00 - 18:00' : 
                        language === 'en' ? 'Monday to Friday: 10:00 - 18:00' : 
                        'Maandag tot Vrijdag: 10:00 - 18:00'}</div>
                  <div>{language === 'es' ? 'Sábados: 10:00 - 14:00' : 
                        language === 'en' ? 'Saturdays: 10:00 - 14:00' : 
                        'Zaterdagen: 10:00 - 14:00'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">{t("ourServices")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 mr-2" />
                  <h4 className="font-medium text-green-400">{t("trekOfficialDealer")}</h4>
                </div>
                <p className="text-sm text-gray-300">
                  {t("trekOfficialDealerDesc")}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-400">{t("bikeRental")}</h4>
                <p className="text-sm text-gray-300">
                  {t("bikeRentalDesc")}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-400">{t("technicalService")}</h4>
                <p className="text-sm text-gray-300">
                  {t("technicalServiceDesc")}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-400">{t("equipmentSales")}</h4>
                <p className="text-sm text-gray-300">
                  {t("equipmentSalesDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer inferior */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 Altea Bike Shop & Albir Cycling. {t("allRightsReserved")}.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {language === 'es' ? 'Distribuidor Oficial Trek - Tu partner de confianza para el ciclismo en la Costa Blanca' : 
             language === 'en' ? 'Official Trek Dealer - Your trusted cycling partner in Costa Blanca' : 
             'Officiële Trek Dealer - Uw vertrouwde fietspartner in Costa Blanca'}
          </p>
        </div>
      </div>
    </footer>
  )
}