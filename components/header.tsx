"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LanguageSelector } from "./language-selector"
import { useLanguage } from "@/lib/language-context"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { t } = useLanguage()

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logos - Nombres completos visibles */}
          <div className="flex items-center flex-1 min-w-0 gap-1 md:gap-2">
            <Link href="https://alteabikeshop.com" target="_blank" className="flex items-center flex-shrink-0">
              <Image 
                src="/images/logo.jpg" 
                alt="Altea Bike Shop" 
                width={32} 
                height={32} 
                className="rounded-full md:w-10 md:h-10 object-cover" 
              />
              <span className="ml-1.5 text-xs md:text-base font-bold text-gray-900 whitespace-nowrap">
                Altea Bike Shop
              </span>
            </Link>
            
            <span className="mx-1 md:mx-2 text-gray-300 text-sm md:text-lg">|</span>
            
            <Link href="https://albir-cycling.com" target="_blank" className="flex items-center flex-shrink-0">
              <Image 
                src="/images/albir-cycling-logo.jpeg" 
                alt="Albir Cycling" 
                width={60} 
                height={30} 
                className="md:w-20 md:h-10 object-contain" 
                style={{ width: 'auto', height: '28px' }}
              />
              <span className="ml-1 md:ml-2 text-xs md:text-base font-bold text-gray-900 whitespace-nowrap">
                Albir Cycling
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2 lg:space-x-3">
            <Link href="/" className="text-gray-700 hover:text-green-600 transition-colors text-xs lg:text-sm whitespace-nowrap">
              {t("home")}
            </Link>
            <Link href="/catalog" className="text-gray-700 hover:text-green-600 transition-colors text-xs lg:text-sm whitespace-nowrap">
              {t("catalog")}
            </Link>
            
            {/* ✅ BOTONES PEQUEÑOS SIN ICONOS */}
            <Link href="/reserve?type=bikes">
              <Button 
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white text-[10px] lg:text-xs h-6 lg:h-7 px-2 lg:px-2.5 whitespace-nowrap"
              >
                {t("reserveBikes")}
              </Button>
            </Link>
            <Link href="/reserve?type=scooters">
              <Button 
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] lg:text-xs h-6 lg:h-7 px-2 lg:px-2.5 whitespace-nowrap"
              >
                {t("reserveScooters")}
              </Button>
            </Link>
            
            <LanguageSelector />
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="h-8 w-8">
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-3 pt-2 pb-3 space-y-1.5 bg-white border-t">
              <Link
                href="/"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                {t("home")}
              </Link>
              <Link
                href="/catalog"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                {t("catalog")}
              </Link>
              
              {/* ✅ BOTONES EN MÓVIL */}
              <Link
                href="/reserve?type=bikes"
                className="block px-3 py-1"
                onClick={() => setIsMenuOpen(false)}
              >
                <Button 
                  variant="default"
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-sm h-8"
                >
                  {t("reserveBikes")}
                </Button>
              </Link>
              <Link
                href="/reserve?type=scooters"
                className="block px-3 py-1"
                onClick={() => setIsMenuOpen(false)}
              >
                <Button 
                  variant="default"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm h-8"
                >
                  {t("reserveScooters")}
                </Button>
              </Link>
              
              <div className="px-3 pt-1">
                <LanguageSelector />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}