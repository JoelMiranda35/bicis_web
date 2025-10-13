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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24"> {/* Aumenté a h-24 para logos de 200px */}
          <div className="flex items-center">
            {/* Altea Bike Shop con link */}
            <Link href="https://alteabikeshop.com" target="_blank" className="flex items-center">
              <Image 
                src="/images/logo.jpg" 
                alt="Altea Bike Shop" 
                width={50} 
                height={50} 
                className="rounded-full" 
              />
              <span className="ml-2 text-xl font-bold text-gray-900">Altea Bike Shop</span>
            </Link>
            
            {/* Separador */}
            <span className="mx-4 text-gray-300 text-xl">|</span>
            
            {/* Albir Cycling con link */}
            <Link href="https://albir-cycling.com" target="_blank" className="flex items-center">
              <Image 
                src="/images/albir-cycling-logo.jpeg" 
                alt="Albir Cycling" 
                width={200} 
                height={200} 
                className="rounded-full" 
              />
              <span className="ml-3 text-xl font-bold text-gray-900">Albir Cycling</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-700 hover:text-green-600 transition-colors">
              {t("home")}
            </Link>
            <Link href="/catalog" className="text-gray-700 hover:text-green-600 transition-colors">
              {t("catalog")}
            </Link>
            <Link href="/reserve" className="text-gray-700 hover:text-green-600 transition-colors">
              {t("reserve")}
            </Link>
            <LanguageSelector />
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <LanguageSelector />
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
              <Link
                href="/"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t("home")}
              </Link>
              <Link
                href="/catalog"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t("catalog")}
              </Link>
              <Link
                href="/reserve"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t("reserve")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}