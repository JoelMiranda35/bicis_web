"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWithinInterval, isSunday, isSaturday, addDays, parseISO, addMonths, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { calculatePrice, calculateDeposit, calculateInsurance, isValidCategory } from "@/lib/pricing"
import { toast } from "@/components/ui/use-toast"


const convertToMadridTime = (date: Date): Date => {
  const madridTimeZone = "Europe/Madrid";
  const utcDate = new Date(date.toISOString());
  const localString = utcDate.toLocaleString("en-US", { timeZone: madridTimeZone });
  return new Date(localString);
};


type BikeCategory = "ROAD" | "ROAD_PREMIUM" | "MTB" | "CITY_BIKE" | "E_CITY_BIKE" | "E_MTB";

const CATEGORY_NAMES: Record<BikeCategory, string> = {
  ROAD: "Carretera",
  ROAD_PREMIUM: "Carretera Premium",
  MTB: "MTB",
  CITY_BIKE: "Ciudad",
  E_CITY_BIKE: "E-Ciudad",
  E_MTB: "E-MTB"
};

// Función para crear una fecha sin problemas de zona horaria
const createLocalDate = (date?: Date): Date => {
  if (!date) return new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

// Función para formatear fechas consistentemente
const formatDateForDB = (date: Date): string => {
  return date.toISOString();
};

const parseDateFromDB = (dateString: string): Date => {
  return new Date(dateString);
};

const isDateDisabled = (date: Date, isStartDate: boolean = true, currentSelectedDate?: Date): boolean => {
  const today = createLocalDate();
  
  // Permitir seleccionar la fecha actual aunque sea hoy
  if (date < today && !(currentSelectedDate && isSameDay(date, currentSelectedDate))) {
    return true;
  }
  
  // No permitir domingos
  if (isSunday(date)) return true;
  
  return false;
};

const getTimeOptions = (isSaturday: boolean) => {
  if (isSaturday) {
    return ["10:00", "11:00", "12:00", "13:00", "14:00"];
  }
  return ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [bikes, setBikes] = useState<any[]>([])
  const [accessories, setAccessories] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [filteredReservations, setFilteredReservations] = useState<any[]>([])
  const [editingBike, setEditingBike] = useState<any>(null)
  const [editingAccessory, setEditingAccessory] = useState<any>(null)
  const [newReservation, setNewReservation] = useState<any>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_dni: "",
    start_date: createLocalDate(),
    end_date: createLocalDate(addDays(new Date(), 1)),
    pickup_time: "10:00",
    return_time: "18:00",
    bikes: [],
    accessories: [],
    insurance: false,
    status: "confirmed"
  })
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalBikes: 0,
    rentedBikes: 0,
    totalRevenue: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [selectedMonth, setSelectedMonth] = useState<Date>(createLocalDate())
  const [availableBikes, setAvailableBikes] = useState<any[]>([])
  const [reservationStep, setReservationStep] = useState<"dates" | "bikes" | "accessories" | "customer">("dates")
  const [isLoadingBikes, setIsLoadingBikes] = useState(false)

  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuthenticated')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
      fetchData()
    }
  }, [])

  useEffect(() => {
    if (reservations.length > 0) {
      const filtered = reservations.filter(res => {
        const resDate = new Date(res.start_date)
        return isSameMonth(resDate, selectedMonth)
      })
      setFilteredReservations(filtered)
      calculateStats(filtered)
    }
  }, [reservations, selectedMonth])

  useEffect(() => {
    if (newReservation.start_date && newReservation.end_date) {
      fetchAvailableBikes();
    }
  }, [newReservation.start_date, newReservation.end_date])

  const fetchData = async () => {
    try {
      setError(null)
      const [bikesRes, accessoriesRes, reservationsRes] = await Promise.all([
        supabase.from("bikes").select("*").order("created_at", { ascending: false }),
        supabase.from("accessories").select("*").order("created_at", { ascending: false }),
        supabase.from("reservations")
          .select(`
            id,
            customer_name,
            customer_email,
            customer_phone,
            customer_dni,
            start_date,
            end_date,
            pickup_time,
            return_time,
            total_days,
            total_amount,
            deposit_amount,
            status,
            bikes,
            accessories,
            insurance,
            created_at
          `)
          .order("created_at", { ascending: false })
      ])

      if (bikesRes.error) throw bikesRes.error
      if (accessoriesRes.error) throw accessoriesRes.error
      if (reservationsRes.error) throw reservationsRes.error

      const formattedReservations = (reservationsRes.data || []).map(res => ({
        ...res,
        start_date: parseDateFromDB(res.start_date),
        end_date: parseDateFromDB(res.end_date)
      }));

      setBikes(bikesRes.data || [])
      setAccessories(accessoriesRes.data || [])
      setReservations(formattedReservations)
    } catch (error: any) {
      setError(error.message || "Error al cargar los datos")
      console.error("Error fetching data:", error)
    }
  }

  const fetchAvailableBikes = async () => {
    if (!newReservation.start_date || !newReservation.end_date) return;

    setIsLoadingBikes(true);
    try {
      const startDateStr = format(newReservation.start_date, 'yyyy-MM-dd');
      const endDateStr = format(newReservation.end_date, 'yyyy-MM-dd');

      const { data: allBikes } = await supabase
        .from("bikes")
        .select("*")
        .eq("available", true);

      const { data: overlappingReservations } = await supabase
        .from("reservations")
        .select("bikes")
        .or(
          `and(start_date.lte.${endDateStr},end_date.gte.${startDateStr})`
        )
        .in("status", ["confirmed", "in_process"]);

      if (allBikes) {
        const reservedBikeIds = new Set();
        overlappingReservations?.forEach((reservation) => {
          reservation.bikes.forEach((bike: any) => {
            if (Array.isArray(bike.bike_ids)) {
              bike.bike_ids.forEach((id: string) => reservedBikeIds.add(id));
            } else {
              reservedBikeIds.add(bike.id);
            }
          });
        });

        const available = allBikes.filter(
          (bike) => !reservedBikeIds.has(bike.id)
        );
        setAvailableBikes(available);
      }
    } catch (error) {
      console.error("Error al obtener bicicletas disponibles:", error);
      setError("Error al obtener bicicletas disponibles");
    } finally {
      setIsLoadingBikes(false);
    }
  };

  const calculateStats = (reservations: any[]) => {
    const totalBikes = bikes.length
    const rentedBikes = new Set(
      reservations
        .filter(res => res.status && ["confirmed", "in_process"].includes(res.status.toLowerCase()))
        .flatMap(res => res.bikes.map((b: any) => b.id))
    ).size
    const totalRevenue = reservations
      .filter(res => !res.status || res.status.toLowerCase() !== 'cancelled')
      .reduce((sum, res) => sum + (res.total_amount || 0), 0)

    setStats({
      totalBikes,
      rentedBikes,
      totalRevenue,
    })
  }

  const handleLogin = () => {
    if (
      credentials.username === "admin" &&
      credentials.password === "Carechimba"
    ) {
      setIsAuthenticated(true)
      localStorage.setItem('adminAuthenticated', 'true')
      fetchData()
    } else {
      setError("Credenciales incorrectas")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('adminAuthenticated')
    setCredentials({ username: "", password: "" })
    setError(null)
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentReservations = filteredReservations.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleImageUpload = async (file: File, itemId: string, type: "bike" | "accessory" = "bike") => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${type}-${Date.now()}-${itemId}.${fileExt}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from("bicis")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from("bicis")
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error: any) {
      setError(`Error al subir la imagen: ${error.message}`)
      return null
    }
  }

  const saveBike = async (bikeData: any, imageFile?: File) => {
    try {
      setError(null)
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
        result = await supabase
          .from("bikes")
          .update(dataToSave)
          .eq("id", bikeData.id)
          .select()
      } else {
        result = await supabase
          .from("bikes")
          .insert([dataToSave])
          .select()
      }

      if (result.error) throw result.error

      await fetchData()
      setEditingBike(null)
      
      toast({
        title: "Bicicleta guardada",
        description: bikeData.id ? "Bicicleta actualizada correctamente" : "Bicicleta creada correctamente",
        variant: "default",
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      })
    } catch (error: any) {
      setError(`Error al guardar la bicicleta: ${error.message}`)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        action: <AlertCircle className="h-5 w-5 text-red-500" />,
      })
    }
  }

  const deleteBike = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta bicicleta?")) {
      try {
        setError(null)
        const { error } = await supabase
          .from("bikes")
          .delete()
          .eq("id", id)

        if (error) throw error

        await fetchData()
        toast({
          title: "Bicicleta eliminada",
          description: "La bicicleta se ha eliminado correctamente",
          variant: "default",
          action: <CheckCircle className="h-5 w-5 text-green-500" />,
        })
      } catch (error: any) {
        setError(`Error al eliminar la bicicleta: ${error.message}`)
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
          action: <AlertCircle className="h-5 w-5 text-red-500" />,
        })
      }
    }
  }

  const saveAccessory = async (accessoryData: any, imageFile?: File) => {
    try {
      setError(null)
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
        name: {
          es: accessoryData.name_es || '',
          en: accessoryData.name_en || '',
          nl: accessoryData.name_nl || ''
        }
      }

      let result
      if (accessoryData.id) {
        result = await supabase
          .from("accessories")
          .update(dataToSave)
          .eq("id", accessoryData.id)
          .select()
      } else {
        result = await supabase
          .from("accessories")
          .insert([dataToSave])
          .select()
      }

      if (result.error) throw result.error

      await fetchData()
      setEditingAccessory(null)
      
      toast({
        title: "Accesorio guardado",
        description: accessoryData.id ? "Accesorio actualizado correctamente" : "Accesorio creado correctamente",
        variant: "default",
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      })
    } catch (error: any) {
      setError(`Error al guardar el accesorio: ${error.message}`)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        action: <AlertCircle className="h-5 w-5 text-red-500" />,
      })
    }
  }

  const deleteAccessory = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este accesorio?")) {
      try {
        setError(null)
        const { error } = await supabase
          .from("accessories")
          .delete()
          .eq("id", id)

        if (error) throw error

        await fetchData()
        toast({
          title: "Accesorio eliminado",
          description: "El accesorio se ha eliminado correctamente",
          variant: "default",
          action: <CheckCircle className="h-5 w-5 text-green-500" />,
        })
      } catch (error: any) {
        setError(`Error al eliminar el accesorio: ${error.message}`)
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
          action: <AlertCircle className="h-5 w-5 text-red-500" />,
        })
      }
    }
  }

  const createReservation = async () => {
  try {
    setError(null);
    
    if (!newReservation.customer_name || !newReservation.customer_email || 
        !newReservation.customer_phone || !newReservation.customer_dni) {
      throw new Error("Todos los campos del cliente son obligatorios");
    }
    
    if (!newReservation.start_date || !newReservation.end_date) {
      throw new Error("Debe seleccionar fechas de inicio y fin");
    }
    
    if (newReservation.bikes.length === 0) {
      throw new Error("Debe seleccionar al menos una bicicleta");
    }
    
    const startDate = new Date(newReservation.start_date);
    const endDate = new Date(newReservation.end_date);
    
    const totalDays = calculateTotalDays(
      new Date(newReservation.start_date),
      new Date(newReservation.end_date),
      newReservation.pickup_time,
      newReservation.return_time
    );
    
    const bikesForDB = newReservation.bikes.map((bike: any) => ({
      id: bike.id,
      title_es: bike.title_es || bike.title,
      size: bike.size,
      category: bike.category,
      bike_ids: [bike.id],
      price_per_day: calculatePrice(bike.category, 1), // Precio por día
      total_price: calculatePrice(bike.category, totalDays) // Precio total
    }));
    
    let totalAmount = 0;
    let depositAmount = 0;
    
    bikesForDB.forEach((bike: any) => {
      if (isValidCategory(bike.category)) {
        totalAmount += bike.total_price;
        depositAmount += calculateDeposit(bike.category);
      }
    });
    
    newReservation.accessories.forEach((acc: any) => {
      totalAmount += (acc.price || 0) * totalDays;
    });

    if (newReservation.insurance) {
      totalAmount += calculateInsurance(totalDays);
    }

    const dataToSave = {
      ...newReservation,
      start_date: formatDateForDB(startDate),
      end_date: formatDateForDB(endDate),
      total_days: totalDays,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      paid_amount: totalAmount,
      status: "confirmed",
      created_at: new Date().toISOString(),
      locale: "es",
      bikes: bikesForDB,
      accessories: newReservation.accessories.map((acc: any) => ({
        id: acc.id,
        name_es: acc.name_es || acc.name,
        price: acc.price,
        total: acc.price * totalDays
      }))
    };

    const { error } = await supabase
      .from("reservations")
      .insert([dataToSave]);

    if (error) throw error;

    await fetchData();
    setNewReservation({
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      customer_dni: "",
      start_date: createLocalDate(),
      end_date: createLocalDate(addDays(new Date(), 1)),
      pickup_time: "10:00",
      return_time: "18:00",
      bikes: [],
      accessories: [],
      insurance: false,
      status: "confirmed"
    });
    setReservationStep("dates");
    
    toast({
      title: "Reserva creada",
      description: "La reserva se ha creado correctamente",
      variant: "default",
      action: <CheckCircle className="h-5 w-5 text-green-500" />,
    });
  } catch (error: any) {
    setError(`Error al crear la reserva: ${error.message}`);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
      action: <AlertCircle className="h-5 w-5 text-red-500" />,
    });
  }
};

  const updateReservationStatus = async (id: string, status: string) => {
    try {
      setError(null);
      
      const { data: reservation, error: fetchError } = await supabase
        .from("reservations")
        .select("bikes, status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("reservations")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      if (status === "completed" || status === "cancelled") {
        const bikeIds = reservation.bikes.flatMap((bike: any) => 
          Array.isArray(bike.bike_ids) ? bike.bike_ids : [bike.id]
        );

        const { error: updateBikesError } = await supabase
          .from("bikes")
          .update({ available: true })
          .in("id", bikeIds);

        if (updateBikesError) throw updateBikesError;
      }

      await fetchData();
      
      toast({
        title: "Estado actualizado",
        description: `El estado de la reserva se ha actualizado a ${status}`,
        variant: "default",
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      })
    } catch (error: any) {
      setError(`Error al actualizar la reserva: ${error.message}`);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        action: <AlertCircle className="h-5 w-5 text-red-500" />,
      })
    }
  };

const toggleBikeSelection = (bike: any) => {
  const isSelected = newReservation.bikes.some((b: any) => b.id === bike.id);
  if (isSelected) {
    setNewReservation({
      ...newReservation,
      bikes: newReservation.bikes.filter((b: any) => b.id !== bike.id)
    });
  } else {      
    setNewReservation({
      ...newReservation,
      bikes: [
        ...newReservation.bikes,
        {
          id: bike.id,
          title: bike.title_es || bike.title,
          size: bike.size,
          category: bike.category,
          price_per_day: calculatePrice(bike.category, 1) // Guardamos precio por día
        }
      ]
    });
  }
};

  const toggleAccessorySelection = (accessory: any) => {
    const isSelected = newReservation.accessories.some((a: any) => a.id === accessory.id)
    if (isSelected) {
      setNewReservation({
        ...newReservation,
        accessories: newReservation.accessories.filter((a: any) => a.id !== accessory.id)
      })
    } else {
      setNewReservation({
        ...newReservation,
        accessories: [
          ...newReservation.accessories,
          {
            id: accessory.id,
            name: accessory.name_es || accessory.name,
            price: accessory.price
          }
        ]
      })
    }
  }
  
 const calculateTotalDays = (startDate: Date, endDate: Date, pickupTime: string, returnTime: string): number => {
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  if (isSameDay(startDay, endDay)) return 1;

  const diffDays = Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));

  if (returnTime <= pickupTime) {
    return diffDays;
  }

  return diffDays + 1;
};

  const calculateTotalDeposit = () => {
    return newReservation.bikes.reduce((sum: number, bike: any) => {
      return sum + (isValidCategory(bike.category) ? calculateDeposit(bike.category) : 0);
    }, 0);
  };

  const calculateTotalPrice = () => {
  if (!newReservation.start_date || !newReservation.end_date) return 0;
  
  const days = calculateTotalDays(
    new Date(newReservation.start_date),
    new Date(newReservation.end_date),
    newReservation.pickup_time,
    newReservation.return_time
  );
  
  let total = 0;
  newReservation.bikes.forEach((bike: any) => {
    total += calculatePrice(bike.category, days);
  });
  
  newReservation.accessories.forEach((acc: any) => {
    total += (acc.price || 0) * days;
  });
  
  if (newReservation.insurance) {
    total += calculateInsurance(days);
  }
  
  return total;
};

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Panel de Administración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}
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
          <Button variant="outline" onClick={handleLogout}>
            Cerrar Sesión
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Bicicletas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBikes}</div>
              <CardDescription>Total en inventario</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Alquiladas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rentedBikes}</div>
              <CardDescription>Bicis actualmente alquiladas</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRevenue}€</div>
              <CardDescription>Total generado</CardDescription>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reservations" className="space-y-6">
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
                            src={bike.image_url}
                            alt={bike.title_es || bike.title || ""}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = "none"
                              const fallback = target.parentElement?.querySelector(".fallback-icon")
                              if (fallback) {
                                (fallback as HTMLElement).style.display = "flex"
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
                        <Badge>{CATEGORY_NAMES[bike.category as BikeCategory] || bike.category}</Badge>
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
                            src={accessory.image_url}
                            alt={accessory.name_es || accessory.name || ""}
                            className="w-full h-full object-cover rounded"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = "none"
                              const fallback = target.parentElement?.querySelector(".fallback-icon")
                              if (fallback) {
                                (fallback as HTMLElement).style.display = "flex"
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
      <div className="flex justify-between items-center">
        <CardTitle>Gestión de Reservas</CardTitle>
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                <CalendarIcon className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(createLocalDate(date))}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {currentReservations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay reservas registradas para este mes
          </div>
        ) : (
          currentReservations.map((reservation) => (
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
                    <strong>Fechas:</strong> {format(reservation.start_date, 'PPP', { locale: es })} - {format(reservation.end_date, 'PPP', { locale: es })}
                  </p>
                  <p className="text-sm flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      Recogida: {reservation.pickup_time} - Devolución: {reservation.return_time}
                    </span>
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
                  {reservation.insurance && (
                    <p className="text-sm">
                      <strong>Seguro:</strong> Sí
                    </p>
                  )}
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
                    {reservation.bikes?.map((bike: any, index: number) => {
                      const pricePerDay = bike.price_per_day || 
                        (isValidCategory(bike.category) ? calculatePrice(bike.category, 1) : 0);
                      const totalPrice = bike.total_price || pricePerDay * reservation.total_days;
                      const bikeName = bike.title_es || bike.title || bike.model;
                      return (
                        <p key={index} className="text-sm text-gray-600">
                          {bikeName} - Talla {bike.size} ({pricePerDay}€/día × {reservation.total_days} días = {totalPrice}€)
                        </p>
                      );
                    })}
                  </div>

                  {reservation.accessories && reservation.accessories.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Accesorios:</h4>
                      {reservation.accessories.map((accessory: any, index: number) => (
                        <p key={index} className="text-sm text-gray-600">
                          {accessory.name || accessory.name_es} - {accessory.price}€/día × {reservation.total_days} días = {accessory.price * reservation.total_days}€
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredReservations.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredReservations.length)} de {filteredReservations.length} reservas
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
              <Button
                key={number}
                variant={currentPage === number ? "default" : "outline"}
                size="sm"
                onClick={() => paginate(number)}
              >
                {number}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>

          <TabsContent value="create-reservation">
            <Card>
              <CardHeader>
                <CardTitle>Crear Nueva Reserva</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reservationStep === "dates" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Fecha de inicio*</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newReservation.start_date ? (
                                  format(newReservation.start_date, "PPP", { locale: es })
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={newReservation.start_date}
                                onSelect={(date) => {
                                  if (!date) return;
                                  const newDate = createLocalDate(date);
                                  const isSaturday = newDate.getDay() === 6;

                                  if (isSunday(newDate)) {
                                    setError("No se puede seleccionar domingo como fecha de inicio");
                                    return;
                                  }

                                  setNewReservation({
                                    ...newReservation,
                                    start_date: newDate,
                                    pickup_time: isSaturday ? "10:00" : "10:00",
                                    return_time: isSaturday ? "14:00" : "18:00",
                                  });
                                  setError(null);
                                }}
                                initialFocus
                                locale={es}
                                disabled={(date) => {
                                  const today = createLocalDate();
                                  if (date < today && !isSameDay(date, today)) {
                                    return true;
                                  }
                                  return isSunday(date);
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Fecha de fin*</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newReservation.end_date ? (
                                  format(newReservation.end_date, "PPP", { locale: es })
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={newReservation.end_date}
                                onSelect={(date) => {
                                  if (!date) return;
                                  const newDate = createLocalDate(date);
                                  
                                  if (isSunday(newDate)) {
                                    setError("No se puede seleccionar domingo como fecha de fin");
                                    return;
                                  }
                                  
                                  if (newReservation.start_date && newDate <= newReservation.start_date) {
                                    setError("La fecha de fin debe ser posterior a la fecha de inicio");
                                    return;
                                  }

                                  const isSaturday = newDate.getDay() === 6;
                                  setNewReservation({
                                    ...newReservation,
                                    end_date: newDate,
                                    return_time: isSaturday ? "14:00" : "18:00"
                                  });
                                  setError(null);
                                }}
                                initialFocus
                                locale={es}
                                disabled={(date) => {
                                  const today = createLocalDate();
                                  const selectedDate = date ? createLocalDate(date) : new Date();
                                  
                                  if (selectedDate < today) return true;
                                  
                                  if (isSunday(selectedDate)) return true;
                                  
                                  if (newReservation.start_date && selectedDate <= newReservation.start_date) return true;
                                  
                                  return false;
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {error && (
                        <div className="text-red-500 text-sm">{error}</div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Hora de recogida*</Label>
                          <Select
                            value={newReservation.pickup_time}
                            onValueChange={(value) => setNewReservation({ ...newReservation, pickup_time: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getTimeOptions(isSaturday(newReservation.start_date)).map(time => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500 mt-1">
                            Lunes a Viernes: 10:00 - 18:00 | Sábados: 10:00 - 14:00
                          </p>
                        </div>
                        <div>
                          <Label>Hora de devolución*</Label>
                          <Select
                            value={newReservation.return_time}
                            onValueChange={(value) => setNewReservation({ ...newReservation, return_time: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getTimeOptions(isSaturday(newReservation.end_date)).map(time => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {newReservation.start_date && newReservation.end_date && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">
                            <strong>Duración:</strong>{" "}
                            {calculateTotalDays(
                              new Date(newReservation.start_date),
                              new Date(newReservation.end_date),
                              newReservation.pickup_time,
                              newReservation.return_time
                            )}{" "}
                            días
                          </p>
                          <p className="text-sm text-green-800">
                            <strong>Desde:</strong>{" "}
                            {format(newReservation.start_date, 'PPP', { locale: es })} {newReservation.pickup_time} <strong>Hasta:</strong>{" "}
                            {format(newReservation.end_date, 'PPP', { locale: es })} {newReservation.return_time}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-4 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setNewReservation({
                              customer_name: "",
                              customer_email: "",
                              customer_phone: "",
                              customer_dni: "",
                              start_date: createLocalDate(),
                              end_date: createLocalDate(addDays(new Date(), 1)),
                              pickup_time: "10:00",
                              return_time: "18:00",
                              bikes: [],
                              accessories: [],
                              insurance: false,
                              status: "confirmed"
                            })
                            setError(null);
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={() => {
                            if (!newReservation.start_date || !newReservation.end_date) {
                              setError("Debes seleccionar fechas de inicio y fin");
                              return;
                            }
                            if (isSunday(newReservation.start_date) || isSunday(newReservation.end_date)) {
                              setError("No se pueden seleccionar domingos como fecha de inicio o fin");
                              return;
                            }
                            setReservationStep("bikes");
                            setError(null);
                          }}
                        >
                          Siguiente: Seleccionar Bicicletas
                        </Button>
                      </div>
                    </>
                  )}

                  {reservationStep === "bikes" && (
  <>
    <div className="p-4 bg-gray-50 rounded-lg mb-4">
      <div className="flex justify-between">
        <span className="font-medium">Fechas seleccionadas:</span>
        <span>
          {format(newReservation.start_date, 'PPP', { locale: es })} - {format(newReservation.end_date, 'PPP', { locale: es })}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="font-medium">Horario:</span>
        <span>
          Recogida: {newReservation.pickup_time} - Devolución: {newReservation.return_time}
        </span>
      </div>
    </div>

    <div>
      <Label>Bicicletas*</Label>
      {isLoadingBikes ? (
        <div className="text-center py-4">
          <p>Cargando bicicletas disponibles...</p>
        </div>
      ) : availableBikes.length === 0 ? (
        <div className="text-sm text-gray-500 mt-2">
          No hay bicicletas disponibles para las fechas seleccionadas
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          {availableBikes.map((bike) => {
            const days = calculateTotalDays(
              new Date(newReservation.start_date),
              new Date(newReservation.end_date),
              newReservation.pickup_time,
              newReservation.return_time
            );
            const pricePerDay = isValidCategory(bike.category) ? calculatePrice(bike.category, 1) : 0;
            const totalPrice = pricePerDay * days;
            
            return (
              <div
                key={bike.id}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-medium">{bike.title_es || bike.title}</h4>
                  <p className="text-sm text-gray-600">Talla: {bike.size}</p>
                  <p className="text-sm text-gray-600">
                    Precio: {totalPrice}€ ({pricePerDay}€/día × {days} días)
                  </p>
                  <p className="text-xs text-gray-500">Depósito: {calculateDeposit(bike.category)}€</p>
                </div>
                <Button
                  size="sm"
                  variant={
                    newReservation.bikes.some((b: any) => b.id === bike.id)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => toggleBikeSelection(bike)}
                >
                  {newReservation.bikes.some((b: any) => b.id === bike.id)
                    ? "Seleccionada"
                    : "Seleccionar"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {newReservation.bikes.length > 0 && (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium mb-2">Bicicletas seleccionadas:</h4>
        {newReservation.bikes.map((bike: any, index: number) => {
          const days = calculateTotalDays(
            new Date(newReservation.start_date),
            new Date(newReservation.end_date),
            newReservation.pickup_time,
            newReservation.return_time
          );
          const pricePerDay = isValidCategory(bike.category) ? calculatePrice(bike.category, 1) : 0;
          const totalPrice = pricePerDay * days;
          
          return (
            <p key={index} className="text-sm">
              {bike.title} - Talla {bike.size} ({pricePerDay}€/día × {days} días = {totalPrice}€)
            </p>
          );
        })}
      </div>
    )}

    <div className="flex justify-between gap-4 pt-4">
      <Button 
        variant="outline" 
        onClick={() => setReservationStep("dates")}
      >
        Volver a Fechas
      </Button>
      <Button 
        onClick={() => setReservationStep("accessories")}
        disabled={newReservation.bikes.length === 0}
      >
        Siguiente: Accesorios
      </Button>
    </div>
  </>
)}

                  {reservationStep === "accessories" && (
                    <>
                      <div className="p-4 bg-gray-50 rounded-lg mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Fechas:</h4>
                            <p>
                              {format(newReservation.start_date, 'PPP', { locale: es })} - {format(newReservation.end_date, 'PPP', { locale: es })}
                            </p>
                            <p>
                              Recogida: {newReservation.pickup_time} - Devolución: {newReservation.return_time}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Bicicletas seleccionadas:</h4>
                            {newReservation.bikes.map((bike: any, index: number) => {
                              const days = Math.ceil(
                                (newReservation.end_date.getTime() - 
                                newReservation.start_date.getTime()) / 
                                (1000 * 60 * 60 * 24)
                              );
                              const pricePerDay = isValidCategory(bike.category) ? calculatePrice(bike.category, days) : 0;
                              return (
                                <p key={index} className="text-sm">
                                  {bike.title} - {pricePerDay}€/día × {days} días = {pricePerDay * days}€
                                </p>
                              );
                            })}
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Total parcial:</h4>
                            <p className="text-lg font-bold">
                              {calculateTotalPrice()}€
                            </p>
                            <p className="text-sm">
                              Depósito: {calculateTotalDeposit()}€
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label>Accesorios</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                          {accessories
                            .filter((accessory) => accessory.available)
                            .map((accessory) => (
                              <div
                                key={accessory.id}
                                className="border rounded-lg p-4 flex items-center justify-between"
                              >
                                <div>
                                  <h4 className="font-medium">
                                    {accessory.name_es || accessory.name}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    {accessory.price}€/día
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={
                                    newReservation.accessories.some(
                                      (a: any) => a.id === accessory.id
                                    )
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => toggleAccessorySelection(accessory)}
                                >
                                  {newReservation.accessories.some(
                                    (a: any) => a.id === accessory.id
                                  )
                                    ? "Seleccionado"
                                    : "Seleccionar"}
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label>Seguro</Label>
                        <div className="border rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">Seguro de daños</h4>
                            <p className="text-sm text-gray-600">
                              5€ por día (máximo 25€ para 5+ días)
                            </p>
                            <p className="text-xs text-gray-500">
                              Cubre daños menores y accidentes
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={newReservation.insurance ? "default" : "outline"}
                            onClick={() => setNewReservation({
                              ...newReservation,
                              insurance: !newReservation.insurance
                            })}
                          >
                            {newReservation.insurance ? "Seleccionado" : "Añadir seguro"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-between gap-4 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setReservationStep("bikes")}
                        >
                          Volver a Bicicletas
                        </Button>
                        <Button 
                          onClick={() => setReservationStep("customer")}
                        >
                          Siguiente: Datos del Cliente
                        </Button>
                      </div>
                    </>
                  )}

                  {reservationStep === "customer" && (
  <>
    <div className="p-4 bg-gray-50 rounded-lg mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="font-medium mb-2">Fechas:</h4>
          <p>
            {format(newReservation.start_date, 'PPP', { locale: es })} - {format(newReservation.end_date, 'PPP', { locale: es })}
          </p>
          <p>
            Recogida: {newReservation.pickup_time} - Devolución: {newReservation.return_time}
          </p>
        </div>
        <div>
          <h4 className="font-medium mb-2">Bicicletas:</h4>
          {newReservation.bikes.map((bike: any, index: number) => (
            <p key={index} className="text-sm">
              {bike.title} - {isValidCategory(bike.category) ? calculatePrice(bike.category, 1) : 0}€/día
            </p>
          ))}
        </div>
        <div>
          <h4 className="font-medium mb-2">Accesorios:</h4>
          {newReservation.accessories.map((acc: any, index: number) => (
            <p key={index} className="text-sm">
              {acc.name} - {acc.price}€/día
            </p>
          ))}
          {newReservation.insurance && (
            <p className="text-sm">
              Seguro: Incluido
            </p>
          )}
        </div>
      </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between">
                            <span className="font-medium">Total estimado:</span>
                            <span className="font-bold">
                              {calculateTotalPrice()}€
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Depósito:</span>
                            <span className="font-bold">
                              {calculateTotalDeposit()}€
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-medium">Total + Depósito:</span>
                            <span className="font-bold">
                              {calculateTotalPrice() + calculateTotalDeposit()}€
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="customer_name">Nombre del cliente*</Label>
                          <Input
                            id="customer_name"
                            value={newReservation.customer_name}
                            onChange={(e) =>
                              setNewReservation({
                                ...newReservation,
                                customer_name: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer_email">Email*</Label>
                          <Input
                            id="customer_email"
                            type="email"
                            value={newReservation.customer_email}
                            onChange={(e) =>
                              setNewReservation({
                                ...newReservation,
                                customer_email: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer_phone">Teléfono*</Label>
                          <Input
                            id="customer_phone"
                            value={newReservation.customer_phone}
                            onChange={(e) =>
                              setNewReservation({
                                ...newReservation,
                                customer_phone: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer_dni">DNI/NIE*</Label>
                          <Input
                            id="customer_dni"
                            value={newReservation.customer_dni}
                            onChange={(e) =>
                              setNewReservation({
                                ...newReservation,
                                customer_dni: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="flex justify-between gap-4 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setReservationStep("accessories")}
                        >
                          Volver a Accesorios
                        </Button>
                        <Button 
                          onClick={createReservation}
                          disabled={
                            !newReservation.customer_name || 
                            !newReservation.customer_email || 
                            !newReservation.customer_phone || 
                            !newReservation.customer_dni
                          }
                        >
                          Confirmar Reserva
                        </Button>
                      </div>
                    </>
                  )}
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
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    setError(null)
    try {
      if (!formData.title_es || !formData.subtitle_es) {
        throw new Error("Los campos en español son obligatorios")
      }
      await onSave({ ...bike, ...formData }, imageFile)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div>
        <Label htmlFor="title_es">Título (ES)*</Label>
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
        <Label htmlFor="subtitle_es">Subtítulo (ES)*</Label>
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
            <SelectItem value="ROAD_PREMIUM">Carretera Premium</SelectItem>
            <SelectItem value="MTB">MTB</SelectItem>
            <SelectItem value="CITY_BIKE">Ciudad</SelectItem>
            <SelectItem value="E_CITY_BIKE">E-Ciudad</SelectItem>
            <SelectItem value="E_MTB">E-MTB</SelectItem>
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

      <div className="flex items-center space-x-2">
        <input
          id="available"
          type="checkbox"
          checked={formData.available}
          onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="available">Disponible</Label>
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

      <div className="flex gap-4 pt-4">
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
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      if (!formData.name_es || formData.price <= 0) {
        throw new Error("Nombre en español y precio válido son obligatorios")
      }
      await onSave({ ...accessory, ...formData }, imageFile)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div>
        <Label htmlFor="name_es">Nombre (ES)*</Label>
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
            <SelectItem value="lock">Candado</SelectItem>
            <SelectItem value="other">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="price">Precio por día (€)*</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) || 0 })}
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="available"
          type="checkbox"
          checked={formData.available}
          onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="available">Disponible</Label>
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

      <div className="flex gap-4 pt-4">
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