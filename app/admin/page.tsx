"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import {
  Plus,
  Edit,
  Trash2,
  Bike,
  ExternalLink,
  Package,
} from "lucide-react"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [bikes, setBikes] = useState<any[]>([])
  const [accessories, setAccessories] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [editingBike, setEditingBike] = useState<any>(null)
  const [editingAccessory, setEditingAccessory] = useState<any>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchData()
    }
  }, [isAuthenticated])

  const handleLogin = () => {
    if (
      credentials.username === "admin" &&
      credentials.password === "altea2024"
    ) {
      setIsAuthenticated(true)
    } else {
      alert("Credenciales incorrectas")
    }
  }

  const fetchData = async () => {
    const [bikesRes, accessoriesRes, reservationsRes] = await Promise.all([
      supabase
        .from("bikes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("accessories")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("reservations")
        .select("*")
        .order("created_at", { ascending: false }),
    ])

    if (bikesRes.data) setBikes(bikesRes.data)
    if (accessoriesRes.data) setAccessories(accessoriesRes.data)
    if (reservationsRes.data) setReservations(reservationsRes.data)
  }

  const handleImageUpload = async (
    file: File,
    itemId: string,
    type: "bike" | "accessory" = "bike"
  ) => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${type}-${Date.now()}-${itemId}.${fileExt}`
      const filePath = fileName

      const { data: uploadData, error: uploadError } =
        await supabase.storage.from("bicis").upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        })

      if (uploadError) {
        alert("Error al subir la imagen: " + uploadError.message)
        return null
      }

      const { data: urlData } = supabase.storage
        .from("bicis")
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error) {
      alert("Error al subir la imagen: " + (error as Error).message)
      return null
    }
  }

  const saveBike = async (bikeData: any, imageFile?: File) => {
    try {
      let imageUrl = bikeData.image_url

      if (imageFile) {
        const uploadedUrl = await handleImageUpload(
          imageFile,
          bikeData.id || Date.now().toString(),
          "bike"
        )
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        } else {
          return
        }
      }

      const dataToSave = {
        ...bikeData,
        image_url: imageUrl,
      }

      let result
      if (bikeData.id) {
        result = await supabase.from("bikes").update(dataToSave).eq("id", bikeData.id)
      } else {
        result = await supabase.from("bikes").insert([dataToSave])
      }

      if (result.error) {
        alert("Error al guardar la bicicleta: " + result.error.message)
        return
      }

      fetchData()
      setEditingBike(null)
    } catch {
      alert("Error al guardar la bicicleta")
    }
  }

  const deleteBike = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta bicicleta?")) {
      const { error } = await supabase.from("bikes").delete().eq("id", id)
      if (error) {
        alert("Error al eliminar la bicicleta: " + error.message)
      } else {
        fetchData()
      }
    }
  }

  const saveAccessory = async (accessoryData: any, imageFile?: File) => {
    try {
      let imageUrl = accessoryData.image_url

      if (imageFile) {
        const uploadedUrl = await handleImageUpload(
          imageFile,
          accessoryData.id || Date.now().toString(),
          "accessory"
        )
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        } else {
          return
        }
      }

      const dataToSave = {
        ...accessoryData,
        image_url: imageUrl,
      }

      let result
      if (accessoryData.id) {
        result = await supabase
          .from("accessories")
          .update(dataToSave)
          .eq("id", accessoryData.id)
      } else {
        result = await supabase.from("accessories").insert([dataToSave])
      }

      if (result.error) {
        alert("Error al guardar el accesorio: " + result.error.message)
        return
      }

      fetchData()
      setEditingAccessory(null)
    } catch {
      alert("Error al guardar el accesorio")
    }
  }

  const deleteAccessory = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este accesorio?")) {
      const { error } = await supabase.from("accessories").delete().eq("id", id)
      if (error) {
        alert("Error al eliminar el accesorio: " + error.message)
      } else {
        fetchData()
      }
    }
  }

  const updateReservationStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id)
    if (error) {
      alert("Error al actualizar la reserva: " + error.message)
    } else {
      fetchData()
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Panel de Administración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials({ ...credentials, username: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                />
              </div>
              <Button onClick={handleLogin} className="w-full">
                Iniciar Sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Panel de Administración</h1>
          <Button variant="outline" onClick={() => setIsAuthenticated(false)}>
            Cerrar Sesión
          </Button>
        </div>

        <Tabs defaultValue="bikes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="bikes">Bicicletas</TabsTrigger>
            <TabsTrigger value="accessories">Accesorios</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
            <TabsTrigger value="create-reservation">Nueva Reserva</TabsTrigger>
          </TabsList>

          <TabsContent value="bikes">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Gestión de Bicicletas</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() =>
                          setEditingBike({
                            title_es: "",
                            title_en: "",
                            title_nl: "",
                            subtitle_es: "",
                            subtitle_en: "",
                            subtitle_nl: "",
                            category: "ROAD",
                            size: "M",
                            available: true,
                            image_url: "",
                          })
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Bicicleta
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{editingBike?.id ? "Editar" : "Nueva"} Bicicleta</DialogTitle>
                      </DialogHeader>
                      <BikeForm bike={editingBike} onSave={saveBike} onCancel={() => setEditingBike(null)} />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bikes.map((bike) => (
                    <div key={bike.id} className="border rounded-lg p-4">
                      <div className="aspect-video bg-gray-100 rounded mb-3 relative">
                        {bike.image_url ? (
                          <img
                            src={bike.image_url || "/placeholder.svg"}
                            alt={bike.title_es || bike.title || ""}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = "none"
                              const fallback = target.parentElement?.querySelector(".fallback-icon")
                              if (fallback) {
                                ;(fallback as HTMLElement).style.display = "flex"
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`absolute inset-0 flex items-center justify-center fallback-icon ${
                            bike.image_url ? "hidden" : "flex"
                          }`}
                        >
                          <Bike className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                      <h3 className="font-semibold">{bike.title_es || bike.title}</h3>
                      <p className="text-sm text-gray-600">{bike.subtitle_es || bike.subtitle}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge>{bike.category}</Badge>
                        <Badge variant="outline">{bike.size}</Badge>
                        <Badge variant={bike.available ? "default" : "destructive"}>
                          {bike.available ? "Disponible" : "No disponible"}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => setEditingBike(bike)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteBike(bike.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accessories">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Gestión de Accesorios</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() =>
                          setEditingAccessory({
                            name_es: "",
                            name_en: "",
                            name_nl: "",
                            type: "pedal",
                            price: 0,
                            available: true,
                            image_url: "",
                          })
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Accesorio
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>{editingAccessory?.id ? "Editar" : "Nuevo"} Accesorio</DialogTitle>
                      </DialogHeader>
                      <AccessoryForm
                        accessory={editingAccessory}
                        onSave={saveAccessory}
                        onCancel={() => setEditingAccessory(null)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accessories.map((accessory) => (
                    <div key={accessory.id} className="border rounded-lg p-4">
                      <div className="aspect-video bg-gray-100 rounded mb-3 relative">
                        {accessory.image_url ? (
                          <img
                            src={accessory.image_url || "/placeholder.svg"}
                            alt={accessory.name_es || accessory.name || ""}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = "none"
                              const fallback = target.parentElement?.querySelector(".fallback-icon")
                              if (fallback) {
                                ;(fallback as HTMLElement).style.display = "flex"
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`absolute inset-0 flex items-center justify-center fallback-icon ${
                            accessory.image_url ? "hidden" : "flex"
                          }`}
                        >
                          <Package className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                      <h3 className="font-semibold">{accessory.name_es || accessory.name}</h3>
                      <p className="text-sm text-gray-600">
                        {accessory.type} - {accessory.price}€/día
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge>{accessory.type}</Badge>
                        <Badge variant={accessory.available ? "default" : "destructive"}>
                          {accessory.available ? "Disponible" : "No disponible"}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingAccessory(accessory)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteAccessory(accessory.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Reservas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reservations.map((reservation) => (
                    <div key={reservation.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h3 className="font-semibold">{reservation.customer_name}</h3>
                          <p className="text-sm text-gray-600">{reservation.customer_email}</p>
                          <p className="text-sm text-gray-600">{reservation.customer_phone}</p>
                          <p className="text-sm text-gray-600">DNI: {reservation.customer_dni}</p>
                        </div>

                        <div>
                          <p className="text-sm">
                            <strong>Fechas:</strong> {reservation.start_date} - {reservation.end_date}
                          </p>
                          <p className="text-sm">
                            <strong>Días:</strong> {reservation.total_days}
                          </p>
                          <p className="text-sm">
                            <strong>Total:</strong> {reservation.total_amount}€
                          </p>
                          <p className="text-sm">
                            <strong>Depósito:</strong> {reservation.deposit_amount}€
                          </p>
                        </div>

                        <div>
                          <div className="mb-2">
                            <Badge
                              variant={
                                reservation.status === "confirmed"
                                  ? "default"
                                  : reservation.status === "in_process"
                                  ? "secondary"
                                  : reservation.status === "completed"
                                  ? "default"
                                  : reservation.status === "cancelled"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {reservation.status}
                            </Badge>
                          </div>

                          <Select
                            value={reservation.status}
                            onValueChange={(status) => updateReservationStatus(reservation.id, status)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="confirmed">Confirmada</SelectItem>
                              <SelectItem value="in_process">En proceso</SelectItem>
                              <SelectItem value="completed">Completada</SelectItem>
                              <SelectItem value="cancelled">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Bicicletas:</h4>
                            {reservation.bikes.map((bike: any, index: number) => (
                              <p key={index} className="text-sm text-gray-600">
                                {bike.title} - Talla {bike.size || bike.selectedSize}
                              </p>
                            ))}
                          </div>

                          {reservation.accessories && reservation.accessories.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Accesorios:</h4>
                              {reservation.accessories.map((accessory: any, index: number) => (
                                <p key={index} className="text-sm text-gray-600">
                                  {accessory.name}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create-reservation">
            <Card>
              <CardHeader>
                <CardTitle>Crear Nueva Reserva</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Crear reserva desde el panel de administración</p>
                  <Button asChild>
                    <a href="/reserve?admin=true" target="_blank" className="inline-flex items-center" rel="noreferrer">
                      Abrir Sistema de Reservas
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {editingBike && (
          <Dialog open={!!editingBike} onOpenChange={() => setEditingBike(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingBike?.id ? "Editar" : "Nueva"} Bicicleta</DialogTitle>
              </DialogHeader>
              <BikeForm bike={editingBike} onSave={saveBike} onCancel={() => setEditingBike(null)} />
            </DialogContent>
          </Dialog>
        )}

        {editingAccessory && (
          <Dialog open={!!editingAccessory} onOpenChange={() => setEditingAccessory(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingAccessory?.id ? "Editar" : "Nuevo"} Accesorio</DialogTitle>
              </DialogHeader>
              <AccessoryForm
                accessory={editingAccessory}
                onSave={saveAccessory}
                onCancel={() => setEditingAccessory(null)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

function BikeForm({ bike, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    title_es: bike?.title_es || "",
    title_en: bike?.title_en || "",
    title_nl: bike?.title_nl || "",
    subtitle_es: bike?.subtitle_es || "",
    subtitle_en: bike?.subtitle_en || "",
    subtitle_nl: bike?.subtitle_nl || "",
    category: bike?.category || "ROAD",
    size: bike?.size || "M",
    available: bike?.available ?? true,
    image_url: bike?.image_url || "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    try {
      await onSave({ ...bike, ...formData }, imageFile)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title_es">Título (ES)</Label>
        <Input
          id="title_es"
          value={formData.title_es}
          onChange={(e) => setFormData({ ...formData, title_es: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="title_en">Título (EN)</Label>
        <Input
          id="title_en"
          value={formData.title_en}
          onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="title_nl">Título (NL)</Label>
        <Input
          id="title_nl"
          value={formData.title_nl}
          onChange={(e) => setFormData({ ...formData, title_nl: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="subtitle_es">Subtítulo (ES)</Label>
        <Input
          id="subtitle_es"
          value={formData.subtitle_es}
          onChange={(e) => setFormData({ ...formData, subtitle_es: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="subtitle_en">Subtítulo (EN)</Label>
        <Input
          id="subtitle_en"
          value={formData.subtitle_en}
          onChange={(e) => setFormData({ ...formData, subtitle_en: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="subtitle_nl">Subtítulo (NL)</Label>
        <Input
          id="subtitle_nl"
          value={formData.subtitle_nl}
          onChange={(e) => setFormData({ ...formData, subtitle_nl: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="category">Categoría</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ROAD">Carretera</SelectItem>
            <SelectItem value="MTB">Mountain Bike</SelectItem>
            <SelectItem value="CITY_BIKE">Ciudad</SelectItem>
            <SelectItem value="E_CITY_BIKE">E-City</SelectItem>
            <SelectItem value="E_MTB">E-Mountain</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="size">Talla</Label>
        <Select
          value={formData.size}
          onValueChange={(value) => setFormData({ ...formData, size: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="XS">XS</SelectItem>
            <SelectItem value="S">S</SelectItem>
            <SelectItem value="M">M</SelectItem>
            <SelectItem value="L">L</SelectItem>
            <SelectItem value="XL">XL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="image">Imagen</Label>
        <Input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
        {formData.image_url && (
          <p className="text-xs text-gray-500 mt-1">Imagen actual: {formData.image_url.split("/").pop()}</p>
        )}
      </div>

      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isUploading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isUploading}>
          {isUploading ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  )
}

function AccessoryForm({ accessory, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    name_es: accessory?.name_es || "",
    name_en: accessory?.name_en || "",
    name_nl: accessory?.name_nl || "",
    type: accessory?.type || "pedal",
    price: accessory?.price || 0,
    available: accessory?.available ?? true,
    image_url: accessory?.image_url || "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave({ ...accessory, ...formData }, imageFile)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name_es">Nombre (ES)</Label>
        <Input
          id="name_es"
          value={formData.name_es}
          onChange={(e) => setFormData({ ...formData, name_es: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="name_en">Nombre (EN)</Label>
        <Input
          id="name_en"
          value={formData.name_en}
          onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="name_nl">Nombre (NL)</Label>
        <Input
          id="name_nl"
          value={formData.name_nl}
          onChange={(e) => setFormData({ ...formData, name_nl: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="type">Tipo</Label>
        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pedal">Pedal</SelectItem>
            <SelectItem value="helmet">Casco</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="price">Precio por día (€)</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) })}
          required
        />
      </div>

      <div>
        <Label htmlFor="image">Imagen</Label>
        <Input id="image" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        {formData.image_url && (
          <p className="text-xs text-gray-500 mt-1">Imagen actual: {formData.image_url.split("/").pop()}</p>
        )}
      </div>

      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  )
}
