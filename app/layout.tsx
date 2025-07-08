"use client"

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LanguageProvider } from "@/lib/language-context"
import { usePathname } from "next/navigation"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  // Función para detectar si es dispositivo móvil
  const isMobile = () => {
    if (typeof window !== 'undefined') {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    }
    return false
  }

  // Generamos el enlace adecuado según el dispositivo
  const whatsappLink = isMobile() 
    ? `https://wa.me/34604535972?text=${encodeURIComponent("Hola Altea Bike Shop, necesito información")}`
    : `https://web.whatsapp.com/send?phone=34604535972&text=${encodeURIComponent("Hola Altea Bike Shop, necesito información")}`

  return (
    <html lang="es">
      <body className={inter.className}>
        <LanguageProvider>
          <Header />
          <main>{children}</main>
          <Footer />

          {/* Botón flotante de WhatsApp con tu diseño preferido */}
          {!isAdmin && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: "fixed",
                bottom: "20px",
                right: "20px",
                backgroundColor: "#25D366",
                borderRadius: "50%",
                width: "60px",
                height: "60px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                zIndex: 1000,
              }}
              aria-label="Contactar por WhatsApp"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="35"
                height="35"
                viewBox="0 0 32 32"
                fill="white"
              >
                <path d="M16.001 3.2c-7.058 0-12.8 5.742-12.8 12.8 0 2.25.59 4.451 1.707 6.392L3.2 28.8l6.613-1.685a12.73 12.73 0 0 0 6.188 1.585h.001c7.058 0 12.799-5.742 12.799-12.8S23.06 3.2 16.001 3.2zm0 23.04a10.2 10.2 0 0 1-5.2-1.42l-.372-.22-3.928 1.001 1.045-3.831-.241-.392a10.166 10.166 0 0 1-1.585-5.437c0-5.625 4.575-10.2 10.2-10.2s10.2 4.575 10.2 10.2-4.575 10.2-10.2 10.2zm5.61-7.432c-.308-.154-1.821-.896-2.103-1-.282-.103-.487-.154-.692.154-.205.308-.794 1-0.974 1.205-.179.205-.359.231-.666.077-.308-.154-1.301-.478-2.48-1.524-.917-.817-1.537-1.829-1.717-2.138-.179-.308-.019-.474.135-.628.139-.139.308-.359.462-.538.154-.18.205-.308.308-.513.102-.205.051-.385-.026-.538-.077-.154-.692-1.666-.949-2.283-.25-.6-.504-.513-.692-.513h-.59c-.179 0-.462.066-.705.308s-.923.897-.923 2.191.946 2.54 1.077 2.717c.128.179 1.862 2.872 4.512 4.022.63.271 1.121.433 1.504.553.632.202 1.208.174 1.663.106.507-.075 1.556-.635 1.775-1.246.218-.61.218-1.131.154-1.246-.064-.116-.231-.18-.487-.308z" />
              </svg>
            </a>
          )}
        </LanguageProvider>
      </body>
    </html>
  )
}