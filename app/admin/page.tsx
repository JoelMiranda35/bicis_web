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


const locationOptions = [
  { value: "sucursal_altea", label: "Altea Bike Shop - Calle la Tella 2, Altea" },
  { value: "sucursal_albir", label: "Albir Cycling - Av del Albir 159, El Albir" }
];

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
  end_date: createLocalDate(),
  pickup_time: "10:00",
  return_time: "18:00",
 pickup_location: "sucursal_altea", // ← Cambiado para coincidir con la BD
  return_location: "sucursal_altea",
  bikes: [],
  accessories: [],
  insurance: false,
  status: "confirmed",
  locale: "es",
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
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [locationFilter, setLocationFilter] = useState<string>("all")


  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuthenticated')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
      fetchData()
    }
  }, [])

  useEffect(() => {
  if (reservations.length > 0) {
    let filtered = reservations.filter(res => {
      const resDate = new Date(res.start_date)
      const selectedStart = startOfMonth(selectedMonth)
      const selectedEnd = endOfMonth(selectedMonth)
      return isWithinInterval(resDate, { start: selectedStart, end: selectedEnd })
    })

    // Filtro por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(res => res.status === statusFilter)
    }

    // Filtro por ubicación
if (locationFilter !== "all") {
  filtered = filtered.filter(
    res => res.pickup_location === locationFilter
  )
}


    // Filtro por búsqueda
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(res => 
        res.customer_name.toLowerCase().includes(term) ||
        res.customer_email.toLowerCase().includes(term) ||
        res.customer_phone.includes(term) ||
        res.customer_dni.includes(term)
      )
    }

    setFilteredReservations(filtered)
    calculateStats(filtered)
  }
}, [reservations, selectedMonth, statusFilter, searchTerm, locationFilter])


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
          pickup_location,   
          return_location,
          total_days,
          total_amount,
          deposit_amount,
          status,
          bikes,
          accessories,
          insurance,
          created_at
        `)
        .order("start_date", { ascending: false }) // ← Esto pone las más próximas primero
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

  try {
    setIsLoadingBikes(true);

    // 1️⃣ Traer TODAS las bicis físicas DISPONIBLES
    const { data: allBikes, error: bikesError } = await supabase
      .from("bikes")
      .select("*")
      .eq("available", true);

    if (bikesError) throw bikesError;
    if (!allBikes) {
      setAvailableBikes([]);
      return;
    }

    // 2️⃣ Fechas seleccionadas (Madrid + horas)
    const selStart = convertToMadridTime(new Date(newReservation.start_date));
    selStart.setHours(
      Number(newReservation.pickup_time.split(":")[0]),
      Number(newReservation.pickup_time.split(":")[1])
    );

    const selEnd = convertToMadridTime(new Date(newReservation.end_date));
    selEnd.setHours(
      Number(newReservation.return_time.split(":")[0]),
      Number(newReservation.return_time.split(":")[1])
    );

    // 3️⃣ Traer reservas que se solapan
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("bikes, start_date, end_date, pickup_time, return_time, status")
      .in("status", ["confirmed", "pending", "in_process"])
      .lte("start_date", selEnd.toISOString())
      .gte("end_date", selStart.toISOString());

    if (resError) throw resError;

    const reservedBikeIds = new Set<string>();
    const bikeQuantityMap = new Map<string, number>(); // Para contar cantidad por modelo

    // 4️⃣ Detectar solapamiento REAL y contar CANTIDADES
    reservations?.forEach((res) => {
      const resStart = convertToMadridTime(new Date(res.start_date));
      resStart.setHours(
        Number(res.pickup_time.split(":")[0]),
        Number(res.pickup_time.split(":")[1])
      );

      const resEnd = convertToMadridTime(new Date(res.end_date));
      resEnd.setHours(
        Number(res.return_time.split(":")[0]),
        Number(res.return_time.split(":")[1])
      );

      const overlap = selStart < resEnd && selEnd > resStart;
      if (!overlap) return;

      let bikesInReservation = res.bikes;

      if (typeof bikesInReservation === "string") {
        try {
          bikesInReservation = JSON.parse(bikesInReservation);
        } catch {
          bikesInReservation = [];
        }
      }

      if (Array.isArray(bikesInReservation)) {
        bikesInReservation.forEach((bike: any) => {
          // Contar cantidad TOTAL reservada por modelo
          const bikeKey = `${bike.title_es || bike.title}-${bike.size}`;
          const currentCount = bikeQuantityMap.get(bikeKey) || 0;
          bikeQuantityMap.set(bikeKey, currentCount + (bike.quantity || 1));

          // Agregar IDs de bicis específicas
          if (Array.isArray(bike.bike_ids)) {
            bike.bike_ids.forEach((id: string) =>
              reservedBikeIds.add(id.trim())
            );
          } else if (bike.id) {
            reservedBikeIds.add(bike.id.toString().trim());
          }
        });
      }
    });

    // 5️⃣ Agrupar bicis por modelo y talla, considerando CANTIDADES
    const groupedBikes = allBikes.reduce((acc: any[], bike) => {
      const bikeKey = `${bike.title_es}-${bike.size}`;
      const existingGroup = acc.find(b => b.key === bikeKey);
      
      if (existingGroup) {
        existingGroup.quantity++;
        existingGroup.bikes.push(bike);
      } else {
        // Calcular cuántas están realmente disponibles
        const reservedCount = bikeQuantityMap.get(bikeKey) || 0;
        const totalInGroup = allBikes.filter(
          b => b.title_es === bike.title_es && b.size === bike.size
        ).length;
        
        const availableInGroup = Math.max(0, totalInGroup - reservedCount);
        
        acc.push({
          key: bikeKey,
          title_es: bike.title_es,
          title_en: bike.title_en,
          title_nl: bike.title_nl,
          subtitle_es: bike.subtitle_es,
          subtitle_en: bike.subtitle_en,
          subtitle_nl: bike.subtitle_nl,
          category: bike.category,
          size: bike.size,
          quantity: availableInGroup, // Mostrar SOLO las disponibles
          bikes: [bike],
          totalInStock: totalInGroup, // Total en inventario
          reservedCount: reservedCount // Cuántas están reservadas
        });
      }
      return acc;
    }, []);

    // Filtrar grupos que tengan al menos 1 disponible
    const available = groupedBikes.filter(group => group.quantity > 0);
    
    setAvailableBikes(available);

  } catch (error) {
    console.error("Error calculando disponibilidad admin:", error);
    setAvailableBikes([]);
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
    credentials.username === process.env.NEXT_PUBLIC_ADMIN_USERNAME &&
    credentials.password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD
  ) {
    setIsAuthenticated(true);
    localStorage.setItem('adminAuthenticated', 'true');
    fetchData();
  } else {
    setError("Credenciales incorrectas");
  }
};

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
      },
      price: Number(accessoryData.price) || 0
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
<div className="flex items-center gap-2 mb-4">
  <Label className="mr-2">Idioma:</Label>
  <div className="flex gap-2">
    <Button
      type="button"
      size="sm"
      variant={newReservation.locale === "es" ? "default" : "outline"}
      onClick={() => setNewReservation({ ...newReservation, locale: "es" })}
    >
      ES
    </Button>
    <Button
      type="button"
      size="sm"
      variant={newReservation.locale === "en" ? "default" : "outline"}
      onClick={() => setNewReservation({ ...newReservation, locale: "en" })}
    >
      EN
    </Button>
    <Button
      type="button"
      size="sm"
      variant={newReservation.locale === "nl" ? "default" : "outline"}
      onClick={() => setNewReservation({ ...newReservation, locale: "nl" })}
    >
      NL
    </Button>
  </div>
</div>

const createReservation = async () => {
  try {
    const days = calculateTotalDays(
      new Date(newReservation.start_date),
      new Date(newReservation.end_date),
      newReservation.pickup_time,
      newReservation.return_time
    );

    const bikesForDB = newReservation.bikes.map((bike: any) => {
      const pricePerDay = calculatePrice(bike.category, days);
      return {
        id: bike.id,
        title_es: bike.title_es || bike.title,
        size: bike.size,
        category: bike.category,
        bike_ids: [bike.id],
        quantity: bike.quantity || 1,
        price_per_day: pricePerDay,
        total_price: pricePerDay * days * (bike.quantity || 1),
      };
    });

    let totalAmount = 0;
    let depositAmount = 0;

    bikesForDB.forEach((bike: any) => {
      if (isValidCategory(bike.category)) {
        totalAmount += bike.total_price;
        depositAmount +=
          calculateDeposit(bike.category) * (bike.quantity || 1);
      }
    });

    newReservation.accessories.forEach(
      (acc: any) => (totalAmount += acc.price || 0)
    );

    if (newReservation.insurance) {
      totalAmount +=
        calculateInsurance(days) *
        newReservation.bikes.reduce(
          (sum: number, b: any) => sum + (b.quantity || 1),
          0
        );
    }

    const dataToSave = {
      ...newReservation,
      start_date: formatDateForDB(new Date(newReservation.start_date)),
      end_date: formatDateForDB(new Date(newReservation.end_date)),
      total_days: days,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      paid_amount: totalAmount,
      bikes: bikesForDB,
      locale: newReservation.locale || "es", // ✅ idioma dinámico
      payment_gateway: "admin",
      payment_status: "paid",
       pickup_location: newReservation.pickup_location, // ← NUEVO
  return_location: newReservation.return_location, // ← NUEVO
    };

    const { data, error } = await supabase
      .from("reservations")
      .insert([dataToSave])
      .select()
      .single();

    if (error) throw error;

   

    toast({
      title: "Reserva creada",
      description: "La reserva se ha creado correctamente",
      variant: "default",
    });

    setNewReservation({
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  customer_dni: "",
  start_date: createLocalDate(),
  end_date: createLocalDate(new Date()),
  pickup_time: "10:00",
  return_time: "18:00",
  pickup_location: "sucursal_altea",
  return_location: "sucursal_altea",
  bikes: [],
  accessories: [],
  insurance: false,
  status: "confirmed",
  locale: "es",
});

  } catch (err: any) {
    console.error("Error creando reserva:", err);
    setError(err.message || "Error creando reserva");
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
      bikes: newReservation.bikes.filter((b: any) => b.id !== bike.id),
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
          quantity: 1, // ✅ guardamos cantidad, no precio fijo
        },
      ],
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
  
const calculateTotalDays = (
  startDate: Date,
  endDate: Date,
  pickupTime: string,
  returnTime: string
): number => {
  // SIEMPRE retorna 1 día para reservas en el mismo día
  if (isSameDay(startDate, endDate)) return 1;

  const startDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  const diffDays = Math.floor(
    (endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  // convertir horas a minutos para comparar bien
  const [pickupH, pickupM] = pickupTime.split(":").map(Number);
  const [returnH, returnM] = returnTime.split(":").map(Number);

  // si la devolución es más tarde que la recogida → sumar 1 día
  if (returnH > pickupH || (returnH === pickupH && returnM > pickupM)) {
    return diffDays + 1;
  }

  return diffDays;
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

  // Bicis (precio por día x días x cantidad)
  newReservation.bikes.forEach((bike: any) => {
    const pricePerDay = calculatePrice(bike.category, days);
    total += pricePerDay * days * (bike.quantity || 1);
  });

  // Accesorios (precio fijo)
  newReservation.accessories.forEach((acc: any) => {
    total += acc.price || 0;
  });

  // Seguro (si aplica)
  if (newReservation.insurance) {
    total +=
      calculateInsurance(days) *
      newReservation.bikes.reduce(
        (sum: number, b: any) => sum + (b.quantity || 1),
        0
      );
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
                      <h3 className="font-semibold">{accessory.name?.es || accessory.name_es || accessory.name || ""}</h3>
<p className="text-sm text-gray-600">
  {accessory.type} - {accessory.price === 0 ? "Gratis" : `${accessory.price}€`}
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
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <CardTitle>Gestión de Reservas</CardTitle>
    
    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
      {/* Buscador */}
      <div className="relative">
        <Input
          placeholder="Buscar por nombre y apellido"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-64"
        />
      </div>

      {/* Filtro por estado */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full md:w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="confirmed">Confirmadas</SelectItem>
          <SelectItem value="in_process">En proceso</SelectItem>
          <SelectItem value="completed">Completadas</SelectItem>
          <SelectItem value="cancelled">Canceladas</SelectItem>
        </SelectContent>
      </Select>

      {/* Filtro por ubicación */}
<Select value={locationFilter} onValueChange={setLocationFilter}>
  <SelectTrigger className="w-full md:w-64">
    <SelectValue placeholder="Ubicación" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todas las ubicaciones</SelectItem>

    <SelectItem value="sucursal_altea">
      Altea Bike Shop - Calle la Tella 2, Altea
    </SelectItem>

    <SelectItem value="sucursal_albir">
      Albir Cycling - Av del Albir 159, El Albir
    </SelectItem>
  </SelectContent>
</Select>


      {/* Selector de mes (corregido para incluir meses futuros) */}
{/* Selector de mes (automático desde primer mes con reservas) */}
<Select 
  value={selectedMonth.toISOString()} 
  onValueChange={(value) => setSelectedMonth(new Date(value))}
>
  <SelectTrigger className="w-full md:w-40">
    <SelectValue>
      {format(selectedMonth, 'MMMM yyyy', { locale: es })}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {(() => {
      const options = [];
      const today = new Date();
      
      // Encontrar el mes más antiguo con reservas, o usar fecha fija si no hay
      const oldestReservation = reservations.length > 0 
        ? new Date(Math.min(...reservations.map(r => new Date(r.start_date).getTime())))
        : new Date(2024, 0, 1); // Fecha por defecto si no hay reservas
      
      const startDate = new Date(oldestReservation.getFullYear(), oldestReservation.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);
      
      // Agregar todos los meses
      let current = new Date(startDate);
      while (current <= endDate) {
        options.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }
      
      return options.map((date) => (
        <SelectItem key={date.toISOString()} value={date.toISOString()}>
          {format(date, 'MMMM yyyy', { locale: es })}
        </SelectItem>
      ));
    })()}
  </SelectContent>
</Select>
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
  <strong>Ubicación:</strong> {
    locationOptions.find(loc => loc.value === reservation.pickup_location)?.label || 
    reservation.pickup_location || 
    "No especificada"
  }
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
  className={
    reservation.status === "confirmed"
      ? "bg-black text-white hover:bg-gray-800 border-black" // ← NEGRO para confirmadas
      : reservation.status === "in_process"
      ? "bg-blue-500 text-white hover:bg-blue-600 border-blue-600"
      : reservation.status === "completed"
      ? "bg-green-500 text-white hover:bg-green-600 border-green-600" // ← VERDE para completadas
      : reservation.status === "cancelled"
      ? "bg-red-500 text-white hover:bg-red-600 border-red-600"
      : "bg-gray-500 text-white hover:bg-gray-600 border-gray-600"
  }
>
  {reservation.status === "confirmed" && "Confirmada"}
  {reservation.status === "in_process" && "En proceso"}
  {reservation.status === "completed" && "Completada"}
  {reservation.status === "cancelled" && "Cancelada"}
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
  {(() => {
    // Agrupar bicicletas duplicadas por modelo y talla
    const groupedBikes = reservation.bikes?.reduce((acc: any[], bike: any) => {
      const bikeName = bike.title_es || bike.title || bike.model;
      const key = `${bikeName}-${bike.size}`;
      
      const existing = acc.find((b: any) => b.key === key);
      if (existing) {
        existing.quantity += bike.quantity || 1;
      } else {
        acc.push({
          key,
          name: bikeName,
          size: bike.size,
          quantity: bike.quantity || 1
        });
      }
      return acc;
    }, []) || [];

    return groupedBikes.map((bike: any, index: number) => (
      <p key={index} className="text-sm text-gray-600">
        {bike.name} - Talla {bike.size} {bike.quantity > 1 && `(x${bike.quantity})`}
      </p>
    ));
  })()}
</div>
                   

                  {reservation.accessories && reservation.accessories.length > 0 && (
  <div>
    <h4 className="font-medium mb-2">Accesorios:</h4>
    {reservation.accessories.map((accessory: any, index: number) => (
      <p key={index} className="text-sm text-gray-600">
        {accessory.name?.es || accessory.name_es || accessory.name} - {accessory.price}€/día × {reservation.total_days} días = {accessory.price * reservation.total_days}€
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
     {/* Indicador de resultados filtrados */}
{(statusFilter !== "all" || searchTerm.trim() !== "" || locationFilter !== "all") && (
  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">Filtros aplicados:</span>

      {statusFilter !== "all" && (
        <Badge variant="secondary" className="flex items-center gap-1">
          Estado: {statusFilter}
          <button
            onClick={() => setStatusFilter("all")}
            className="ml-1 text-xs hover:text-red-500"
          >
            ×
          </button>
        </Badge>
      )}

      {searchTerm.trim() !== "" && (
        <Badge variant="secondary" className="flex items-center gap-1">
          Búsqueda: "{searchTerm}"
          <button
            onClick={() => setSearchTerm("")}
            className="ml-1 text-xs hover:text-red-500"
          >
            ×
          </button>
        </Badge>
      )}

      {locationFilter !== "all" && (
        <Badge variant="secondary" className="flex items-center gap-1">
          Ubicación: {locationFilter === "sucursal_altea" ? "Altea" : "Albir"}
          <button
            onClick={() => setLocationFilter("all")}
            className="ml-1 text-xs hover:text-red-500"
          >
            ×
          </button>
        </Badge>
      )}

      <button
        onClick={() => {
          setStatusFilter("all");
          setSearchTerm("");
          setLocationFilter("all");
        }}
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        Limpiar todos
      </button>
    </div>
  </div>
)}


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
                  // Si la fecha de fin es anterior a la nueva fecha de inicio, actualizarla
                  end_date: newReservation.end_date && newDate > newReservation.end_date ? newDate : newReservation.end_date,
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

                // CORRECCIÓN COMPLETA: Permitir cualquier fecha válida
                // Si selecciona una fecha anterior al inicio, mostrar advertencia pero permitirlo
                if (newReservation.start_date && newDate < newReservation.start_date) {
                  // En lugar de bloquear, mostramos advertencia pero permitimos la selección
                  setError("Advertencia: La fecha de fin es anterior a la fecha de inicio. Se ajustará automáticamente.");
                  
                  // Ajustamos automáticamente la fecha de inicio
                  setNewReservation({
                    ...newReservation,
                    start_date: newDate,
                    end_date: newDate,
                    pickup_time: isSaturday(newDate) ? "10:00" : "10:00",
                    return_time: isSaturday(newDate) ? "14:00" : "18:00",
                  });
                } else {
                  // Fecha normal - igual o posterior al inicio
                  const isSaturday = newDate.getDay() === 6;
                  setNewReservation({
                    ...newReservation,
                    end_date: newDate,
                    return_time: isSaturday ? "14:00" : "18:00"
                  });
                  setError(null);
                }
              }}
              initialFocus
              locale={es}
              disabled={(date) => {
                const today = createLocalDate();
                const selectedDate = date ? createLocalDate(date) : new Date();
                
                // No permitir fechas pasadas (excepto si es el día actual)
                if (selectedDate < today && !isSameDay(selectedDate, today)) {
                  return true;
                }
                
                // No permitir domingos
                if (isSunday(selectedDate)) return true;
                
                // PERMITIR TODAS LAS FECHAS VÁLIDAS - sin restricción por fecha de inicio
                return false;
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>

    {error && (
      <div className={`text-sm ${error.includes("Advertencia") ? "text-amber-600" : "text-red-500"}`}>
        {error}
      </div>
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

{/* NUEVO: Selector de ubicación */}
<div className="md:col-span-2">
  <Label>Lugar de recogida y retorno*</Label>
  <Select
    value={newReservation.pickup_location}
    onValueChange={(value) => {
      setNewReservation({
        ...newReservation,
        pickup_location: value,
        return_location: value // Siempre el mismo lugar para recogida y retorno
      });
    }}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {locationOptions.map(location => (
        <SelectItem key={location.value} value={location.value}>
          {location.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-gray-500 mt-1">
    El mismo lugar para recogida y devolución
  </p>
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
            end_date: createLocalDate(),
            pickup_time: "10:00",
            return_time: "18:00",
            bikes: [],
            accessories: [],
            insurance: false,
            status: "confirmed",
            locale: "es"
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
          if (newReservation.end_date < newReservation.start_date) {
            setError("La fecha de fin debe ser igual o posterior a la fecha de inicio");
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
          {(() => {
  const groupedBikes = availableBikes.reduce((acc: any[], bike) => {
    const existing = acc.find(b => 
      b.title_es === bike.title_es && 
      b.size === bike.size && 
      b.category === bike.category
    );
    
    if (existing) {
      existing.quantity++;
      existing.bikes.push(bike);
    } else {
      acc.push({
        ...bike,
        quantity: 1,
        bikes: [bike]
      });
    }
    return acc;
  }, []);

  return groupedBikes.map((bikeGroup) => {
    const days = calculateTotalDays(
      new Date(newReservation.start_date),
      new Date(newReservation.end_date),
      newReservation.pickup_time,
      newReservation.return_time
    );
    const pricePerDay = isValidCategory(bikeGroup.category) ? calculatePrice(bikeGroup.category, 1) : 0;
    const totalPrice = pricePerDay * days;
    
    const selectedCount = newReservation.bikes.filter((b: any) => 
      b.title === bikeGroup.title_es && b.size === bikeGroup.size
    ).reduce((sum: number, b: any) => sum + (b.quantity || 1), 0);

    return (
      <div
        key={`${bikeGroup.title_es}-${bikeGroup.size}-${bikeGroup.category}`}
        className="border rounded-lg p-4 flex items-center justify-between"
      >
        <div>
          <h4 className="font-medium">{bikeGroup.title_es || bikeGroup.title}</h4>
          <p className="text-sm text-gray-600">Talla: {bikeGroup.size}</p>
          <p className="text-sm text-gray-600">
            Disponibles: {bikeGroup.quantity}
          </p>
          <p className="text-sm text-gray-600">
            Precio: {totalPrice}€ ({pricePerDay}€/día × {days} días)
          </p>
          <p className="text-xs text-gray-500">Depósito: {calculateDeposit(bikeGroup.category)}€</p>
          {selectedCount > 0 && (
            <p className="text-xs text-green-600">Seleccionadas: {selectedCount}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedCount > 0) {
                const newBikes = [...newReservation.bikes];
                const bikeIndex = newBikes.findIndex((b: any) => 
                  b.title === bikeGroup.title_es && b.size === bikeGroup.size
                );
                
                if (bikeIndex >= 0) {
                  if (newBikes[bikeIndex].quantity > 1) {
                    newBikes[bikeIndex].quantity--;
                  } else {
                    newBikes.splice(bikeIndex, 1);
                  }
                  setNewReservation({ ...newReservation, bikes: newBikes });
                }
              }
            }}
            disabled={selectedCount === 0}
          >
            -
          </Button>
          <Button
            size="sm"
            variant={selectedCount > 0 ? "default" : "outline"}
            onClick={() => {
              if (selectedCount < bikeGroup.quantity) {
                const newBikes = [...newReservation.bikes];
                const existingIndex = newBikes.findIndex((b: any) => 
                  b.title === bikeGroup.title_es && b.size === bikeGroup.size
                );
                
                if (existingIndex >= 0) {
                  newBikes[existingIndex].quantity++;
                } else {
                  newBikes.push({
                    id: bikeGroup.bikes[0].id,
                    title: bikeGroup.title_es || bikeGroup.title,
                    size: bikeGroup.size,
                    category: bikeGroup.category,
                    quantity: 1,
                    bikes: [bikeGroup.bikes[0]]
                  });
                }
                setNewReservation({ ...newReservation, bikes: newBikes });
              }
            }}
            disabled={selectedCount >= bikeGroup.quantity}
          >
            +
          </Button>
        </div>
      </div>
    );
  });
})()}
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
    const days = calculateTotalDays(
      new Date(newReservation.start_date),
      new Date(newReservation.end_date),
      newReservation.pickup_time,
      newReservation.return_time
    );
    const pricePerDay = isValidCategory(bike.category) ? calculatePrice(bike.category, 1) : 0;
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
    name_es: accessory?.name?.es || accessory?.name_es || "",
    name_en: accessory?.name?.en || accessory?.name_en || "",
    name_nl: accessory?.name?.nl || accessory?.name_nl || "",
    type: accessory?.type || "pedal",
    price: accessory?.price ?? 0,
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
      if (!formData.name_es) {
        throw new Error("Nombre en español es obligatorio")
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
        <Select 
          value={formData.type} 
          onValueChange={(value) => setFormData({ ...formData, type: value })}
        >
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