"use client"

import { useEffect, useState } from "react"
import { BikeCard } from "@/components/bike-card"
import { AccessoryCard } from "@/components/accessory-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Bike as BikeIcon, Package } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface Bike {
  id: string
  category: string
  size: string
  [key: string]: any
}

interface Accessory {
  id: string
  type: string
  name?: string
  [key: string]: any
}

export default function CatalogPage() {
  const { t, language } = useLanguage()

  const [bikes, setBikes] = useState<Bike[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [filteredBikes, setFilteredBikes] = useState<Bike[]>([])
  const [filteredAccessories, setFilteredAccessories] = useState<Accessory[]>([])
  const [bikeSearchTerm, setBikeSearchTerm] = useState("")
  const [accessorySearchTerm, setAccessorySearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sizeFilter, setSizeFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  useEffect(() => {
    fetchData()
  }, [language])

  useEffect(() => {
    filterBikes()
  }, [bikes, bikeSearchTerm, categoryFilter, sizeFilter])

  useEffect(() => {
    filterAccessories()
  }, [accessories, accessorySearchTerm, typeFilter])

  const fetchData = async () => {
    try {
      const bikesRes = await fetch(`/api/bikes?lang=${language}`)
      const bikesData = await bikesRes.json()
      setBikes(bikesData)

      const accessoriesRes = await fetch(`/api/accessories`)
      const accessoriesData = await accessoriesRes.json()
      setAccessories(accessoriesData)
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  const filterBikes = () => {
    let filtered = bikes

    if (bikeSearchTerm) {
      filtered = filtered.filter((bike: Bike) => {
        const title = bike[`title_${language}`] || ""
        const subtitle = bike[`subtitle_${language}`] || ""
        return (
          title.toLowerCase().includes(bikeSearchTerm.toLowerCase()) ||
          subtitle.toLowerCase().includes(bikeSearchTerm.toLowerCase())
        )
      })
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((bike: Bike) => bike.category === categoryFilter)
    }

    if (sizeFilter !== "all") {
      filtered = filtered.filter((bike: Bike) => bike.size === sizeFilter)
    }

    setFilteredBikes(filtered)
  }

  const filterAccessories = () => {
    let filtered = accessories

    if (accessorySearchTerm) {
      filtered = filtered.filter((accessory: Accessory) =>
        (accessory.name || "").toLowerCase().includes(accessorySearchTerm.toLowerCase())
      )
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((accessory: Accessory) => accessory.type === typeFilter)
    }

    setFilteredAccessories(filtered)
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

  const groupedBikes = filteredBikes.reduce<Record<string, Bike[]>>((acc, bike) => {
    if (!acc[bike.category]) acc[bike.category] = []

    const alreadyExists = acc[bike.category].some(
      b => b.size === bike.size && b[`title_${language}`] === bike[`title_${language}`]
    )
    
    if (!alreadyExists) {
      acc[bike.category].push(bike)
    }
    return acc
  }, {})

  const groupedAccessories = filteredAccessories.reduce<Record<string, Accessory[]>>((acc, accessory) => {
    if (!acc[accessory.type]) acc[accessory.type] = []
    acc[accessory.type].push(accessory)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t("bikeCatalog")}</h1>
          <p className="text-lg text-gray-600">{t("catalogSubtitle")}</p>
        </div>
      </section>

      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="bikes" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="bikes" className="flex items-center gap-2">
                <BikeIcon className="h-4 w-4" />
                {t("bikes")} ({filteredBikes.length})
              </TabsTrigger>
              <TabsTrigger value="accessories" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t("accessories")} ({filteredAccessories.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bikes">
              <div className="py-6">
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={t("searchBikes")}
                      value={bikeSearchTerm}
                      onChange={(e) => setBikeSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder={t("catalog")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allCategories")}</SelectItem>
                      <SelectItem value="ROAD">{t("road")}</SelectItem>
                      <SelectItem value="MTB">{t("mtb")}</SelectItem>
                      <SelectItem value="CITY_BIKE">{t("cityBike")}</SelectItem>
                      <SelectItem value="E_CITY_BIKE">{t("eCityBike")}</SelectItem>
                      <SelectItem value="E_MTB">{t("eMtb")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger className="w-full md:w-32">
                      <SelectValue placeholder={t("size")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allSizes")}</SelectItem>
                      <SelectItem value="XS">XS</SelectItem>
                      <SelectItem value="S">S</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="XL">XL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {Object.keys(groupedBikes).length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">{t("noBikesFound")}</p>
                  </div>
                ) : (
                  Object.entries(groupedBikes).map(([category, categoryBikes]) => (
                    <div key={category} className="mb-12">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        {getCategoryName(category)} ({categoryBikes.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {categoryBikes.map((bike: Bike) => (
                          <BikeCard key={bike.id} bike={bike} language={language} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="accessories">
              <div className="py-6">
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={
                        language === "es"
                          ? "Buscar accesorios..."
                          : language === "en"
                          ? "Search accessories..."
                          : "Zoek accessoires..."
                      }
                      value={accessorySearchTerm}
                      onChange={(e) => setAccessorySearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue
                        placeholder={
                          language === "es"
                            ? "Todos los tipos"
                            : language === "en"
                            ? "All types"
                            : "Alle types"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {language === "es"
                          ? "Todos los tipos"
                          : language === "en"
                          ? "All types"
                          : "Alle types"}
                      </SelectItem>
                      <SelectItem value="pedal">
                        {language === "es"
                          ? "Pedales"
                          : language === "en"
                          ? "Pedals"
                          : "Pedalen"}
                      </SelectItem>
                      <SelectItem value="helmet">
                        {language === "es"
                          ? "Cascos"
                          : language === "en"
                          ? "Helmets"
                          : "Helmen"}
                      </SelectItem>
                      <SelectItem value="other">
                        {language === "es"
                          ? "Otros"
                          : language === "en"
                          ? "Other"
                          : "Overig"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {Object.keys(groupedAccessories).length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">
                      {language === "es"
                        ? "No se encontraron accesorios"
                        : language === "en"
                        ? "No accessories found"
                        : "Geen accessoires gevonden"}
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedAccessories).map(([type, typeAccessories]) => (
                    <div key={type} className="mb-12">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        {type === "pedal"
                          ? language === "es"
                            ? "Pedales"
                            : language === "en"
                            ? "Pedals"
                            : "Pedalen"
                          : type === "helmet"
                          ? language === "es"
                            ? "Cascos"
                            : language === "en"
                            ? "Helmets"
                            : "Helmen"
                          : language === "es"
                          ? "Otros"
                          : language === "en"
                          ? "Other"
                          : "Overig"}{" "}
                        ({typeAccessories.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {typeAccessories.map((accessory: Accessory) => (
                          <AccessoryCard key={accessory.id} accessory={accessory} showPrice={false} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section className="bg-green-600 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">{t("readyForAdventure")}</h2>
          <p className="text-xl text-green-100 mb-8">{t("bookFavoriteBike")}</p>
          <Button asChild size="lg" className="bg-white text-green-600 hover:bg-gray-100">
            <a href="/reserve">{t("reserveNow")}</a>
          </Button>
        </div>
      </section>
    </div>
  )
}