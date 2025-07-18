"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import {
  calculatePrice,
  calculateDeposit,
  INSURANCE_PRICE_PER_DAY,
  INSURANCE_MAX_PRICE,
  calculateInsurance,
} from "@/lib/pricing";
import { calculateDays, formatDate, formatDateForDisplay } from "@/lib/utils";
import {
  validateDocument,
  validateEmail,
  validatePhone,
} from "@/lib/validation";
import {
  CalendarDays,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  Bike,
  Plus,
  Minus,
  Package,
  Clock,
  FileText,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-context";
import { useSearchParams } from "next/navigation";
import { TranslationKey, translations } from "@/lib/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays, isSameDay, isSunday, isSaturday } from "date-fns";

type Step =
  | "dates"
  | "bikes"
  | "accessories"
  | "customer"
  | "payment"
  | "confirmation";
type BikeCategory = "ROAD" | "ROAD_PREMIUM" | "MTB" | "CITY_BIKE" | "E_CITY_BIKE" | "E_MTB";

interface BikeModel {
  title_es: string;
  title_en: string;
  title_nl: string;
  subtitle_es: string;
  subtitle_en: string;
  subtitle_nl: string;
  category: BikeCategory;
  availableSizes: { size: string; count: number; bikes: any[] }[];
}

interface SelectedBike {
  title_es: string;
  title_en: string;
  title_nl: string;
  subtitle_es: string;
  subtitle_en: string;
  subtitle_nl: string;
  category: BikeCategory;
  size: string;
  quantity: number;
  bikes: any[];
}

interface Accessory {
  id: string;
  name_es: string;
  name_en: string;
  name_nl: string;
  price: number;
  available: boolean;
}

const translateBikeContent = (
  textObject: { es: string; en: string; nl: string },
  language: string
): string => {
  return textObject[language as "es" | "en" | "nl"] || textObject.es;
};

const createLocalDate = (date?: Date): Date => {
  if (!date) return new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getTimeOptions = (isSaturday: boolean) => {
  if (isSaturday) {
    return ["10:00", "11:00", "12:00", "13:00", "14:00"];
  }
  return ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
};

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

const StoreHoursNotice = ({ t }: { t: (key: TranslationKey) => string }) => (
  <div className="bg-blue-50 p-4 rounded-lg mb-6">
    <div className="flex items-start gap-3">
      <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div>
        <h4 className="font-semibold text-blue-800">{t("storeHoursTitle")}</h4>
        <p className="text-sm text-blue-700">{t("storeHoursContent")}</p>
      </div>
    </div>
  </div>
);

const RentalTermsCheckbox = ({ 
  t, 
  acceptedTerms, 
  setAcceptedTerms, 
  validationErrors, 
  setValidationErrors,
  language
}: { 
  t: (key: TranslationKey) => string,
  acceptedTerms: boolean,
  setAcceptedTerms: (value: boolean) => void,
  validationErrors: Record<string, string>,
  setValidationErrors: (errors: Record<string, string>) => void,
  language: string
}) => {
 const handleDownloadTerms = () => {
  const pdfFiles = {
    es: '/terms/terms_es.pdf',
    en: '/terms/terms_en.pdf',
    nl: '/terms/terms_nl.pdf'
  };
  
  const link = document.createElement('a');
  link.href = pdfFiles[language as keyof typeof pdfFiles];
  link.download = `terms_${language}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => {
                setAcceptedTerms(checked as boolean);
                if (validationErrors.terms) {
                  setValidationErrors({ ...validationErrors, terms: "" });
                }
              }}
            />
            <Label htmlFor="terms" className="font-medium">
              {t("rentalTermsTitle")}
            </Label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 hover:text-blue-800"
              onClick={handleDownloadTerms}
            >
              <Download className="h-4 w-4 mr-1" />
              {t("downloadTerms")}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            {t("rentalTermsContent")}
          </p>
          {validationErrors.terms && (
            <p className="text-red-500 text-sm">
              {validationErrors.terms}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentForm = ({ 
  amount, 
  t,
  onBack,
  reservationId,
  customerData
}: {
  amount: number,
  t: (key: TranslationKey) => string,
  onBack: () => void,
  reservationId: string,
  customerData: {
    name: string;
    email: string;
    phone: string;
    dni: string;
  }
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });

  const handleCardDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'number') {
      const cleanedValue = value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
      const formattedValue = cleanedValue.replace(/(\d{4})/g, '$1 ').trim();
      setCardData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } 
    else if (name === 'expiry') {
      const cleanedValue = value.replace(/[^0-9]/g, '');
      let formattedValue = cleanedValue;
      if (cleanedValue.length > 2) {
        formattedValue = `${cleanedValue.slice(0, 2)}/${cleanedValue.slice(2, 4)}`;
      }
      setCardData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    }
    else if (name === 'cvv') {
      setCardData(prev => ({
        ...prev,
        [name]: value.replace(/[^0-9]/g, '')
      }));
    } else {
      setCardData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePayment = async () => {
  setIsProcessing(true);
  setError(null);

  try {
    // Validaciones de los datos de la tarjeta...
    if (!cardData.number || !cardData.expiry || !cardData.cvv || !cardData.name) {
      throw new Error(t("validationCardDataRequired"));
    }

    const cleanedCardNumber = cardData.number.replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(cleanedCardNumber)) {
      throw new Error(t("validationInvalidCardNumber"));
    }

    if (!/^\d{2}\/\d{2}$/.test(cardData.expiry)) {
      throw new Error(t("validationInvalidExpiry"));
    }

    if (!/^\d{3,4}$/.test(cardData.cvv)) {
      throw new Error(t("validationInvalidCVV"));
    }

    if (cardData.name.trim().length < 3) {
      throw new Error(t("validationInvalidCardName"));
    }

    // Preparar datos para el pago
    const [expMonth, expYear] = cardData.expiry.split('/');
    const paymentData = {
      amount: amount,
      orderId: reservationId,
      customerEmail: customerData.email,
      customerName: customerData.name.trim(),
      cardNumber: cleanedCardNumber,
      cardExpiry: `${expMonth}${expYear}`,
      cardCVV: cardData.cvv,
      cardName: cardData.name.trim(),
      currency: 'EUR'
    };

    // Enviar pago al servidor
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    const responseData = await res.json();

    if (!res.ok || !responseData.success) {
      throw new Error(responseData.error || t("paymentProcessingError"));
    }

    // Pago exitoso
    window.location.href = `/reserva-exitosa?order=${reservationId}`;

  } catch (err) {
    console.error('Error en el proceso de pago:', err);
    const errorMessage = err instanceof Error ? err.message : t("unknownError");
    setError(errorMessage);
    
    // Registrar el error en Supabase
    await supabase.from("payment_errors").insert({
      reservation_id: reservationId,
      error_type: "payment_processing",
      error_data: JSON.stringify({
        customer: customerData.email,
        error: errorMessage,
        card_data: {
          last4: cardData.number.slice(-4),
          expiry: cardData.expiry
        }
      })
    });
  } finally {
    setIsProcessing(false);
  }
};

  return (
    <div className="border rounded-lg p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">{t("paymentDetails")}</h3>
      
      <div className="bg-gray-50 p-4 rounded-lg my-6">
        <div className="flex justify-between font-semibold">
          <span>{t("amountToPay")}:</span>
          <span>{amount.toFixed(2)}{t("euro")}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="cardNumber">{t("cardNumber")} *</Label>
          <Input
            id="cardNumber"
            name="number"
            value={cardData.number}
            onChange={handleCardDataChange}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expiry">{t("expiryDate")} (MM/YY) *</Label>
            <Input
              id="expiry"
              name="expiry"
              value={cardData.expiry}
              onChange={handleCardDataChange}
              placeholder="MM/YY"
              maxLength={5}
            />
          </div>
          <div>
            <Label htmlFor="cvv">{t("cvv")} *</Label>
            <Input
              id="cvv"
              name="cvv"
              value={cardData.cvv}
              onChange={handleCardDataChange}
              placeholder="123"
              maxLength={4}
              type="password"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="cardName">{t("cardName")} *</Label>
          <Input
            id="cardName"
            name="name"
            value={cardData.name}
            onChange={handleCardDataChange}
            placeholder={t("cardholderName")}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg my-4">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-red-500 mt-1">
            {t("paymentErrorHelpText")}
          </p>
          <Button
            variant="link"
            className="text-blue-600 p-0 h-auto"
            onClick={() => window.location.reload()}
          >
            {t("tryAgain")}
          </Button>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg my-6">
        <p className="text-sm text-blue-700">
          {t("securePaymentNotice")}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          {t("paymentProcessedSecurely")}
        </p>
      </div>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          {t("back")}
        </Button>
        <Button
          onClick={handlePayment}
          className="flex-1"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t("processingPayment")}
            </span>
          ) : (
            t("payNow")
          )}
        </Button>
      </div>
    </div>
  );
};

export default function ReservePage() {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const isAdminMode = searchParams.get("admin") === "true";

  const [currentStep, setCurrentStep] = useState<Step>("dates");
  const [startDate, setStartDate] = useState<Date>(createLocalDate());
  const [endDate, setEndDate] = useState<Date>(createLocalDate(addDays(new Date(), 1)));
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("18:00");
  const [availableBikes, setAvailableBikes] = useState<any[]>([]);
  const [bikeModels, setBikeModels] = useState<BikeModel[]>([]);
  const [selectedBikes, setSelectedBikes] = useState<SelectedBike[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<Accessory[]>([]);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
    dni: "",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [reservationId, setReservationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBikes, setIsLoadingBikes] = useState(false);
  const [isLoadingAccessories, setIsLoadingAccessories] = useState(false);
  const [bikesAvailabilityChecked, setBikesAvailabilityChecked] = useState(false);

  useEffect(() => {
    const fetchAccessories = async () => {
      setIsLoadingAccessories(true);
      try {
        const { data } = await supabase
          .from("accessories")
          .select("*")
          .eq("available", true);
        if (data) {
          setAccessories(data);
        }
      } catch (error) {
        console.error("Error fetching accessories:", error);
      } finally {
        setIsLoadingAccessories(false);
      }
    };
    fetchAccessories();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAvailableBikes();
      setPickupTime(isSaturday(startDate) ? "10:00" : "10:00");
      setReturnTime(isSaturday(endDate) ? "14:00" : "18:00");
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (availableBikes.length > 0) {
      groupBikesByModel();
    }
  }, [availableBikes]);

  const fetchAvailableBikes = async () => {
    if (!startDate || !endDate) return;

    setIsLoadingBikes(true);
    try {
      const { data: allBikes, error: bikesError } = await supabase
        .from("bikes")
        .select("*")
        .eq("available", true);

      if (bikesError) throw bikesError;

      const { data: overlappingReservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("bikes")
        .or(
          `and(start_date.lte.${formatDate(endDate)},end_date.gte.${formatDate(startDate)})`
        )
        .in("status", ["confirmed", "in_process"]);

      if (reservationsError) throw reservationsError;

      if (allBikes) {
        const reservedBikeIds = new Set();
        overlappingReservations?.forEach((reservation) => {
          reservation.bikes.forEach((bike: any) => {
            bike.bike_ids?.forEach((id: string) => reservedBikeIds.add(id));
          });
        });

        const available = allBikes.filter(
          (bike) => !reservedBikeIds.has(bike.id)
        );
        setAvailableBikes(available);
      }
    } catch (error) {
      console.error("Error fetching available bikes:", error);
    } finally {
      setIsLoadingBikes(false);
    }
  };

  const groupBikesByModel = () => {
    const grouped = availableBikes.reduce(
      (acc: Record<string, BikeModel>, bike) => {
        const key = `${bike.title_es}-${bike.category}`;
        if (!acc[key]) {
          acc[key] = {
            title_es: bike.title_es,
            title_en: bike.title_en,
            title_nl: bike.title_nl,
            subtitle_es: bike.subtitle_es,
            subtitle_en: bike.subtitle_en,
            subtitle_nl: bike.subtitle_nl,
            category: bike.category as BikeCategory,
            availableSizes: [],
          };
        }

        const existingSizeIndex = acc[key].availableSizes.findIndex(
          (s) => s.size === bike.size
        );
        if (existingSizeIndex >= 0) {
          acc[key].availableSizes[existingSizeIndex].count++;
          acc[key].availableSizes[existingSizeIndex].bikes.push(bike);
        } else {
          acc[key].availableSizes.push({
            size: bike.size,
            count: 1,
            bikes: [bike],
          });
        }

        return acc;
      },
      {}
    );

    setBikeModels(Object.values(grouped));
  };

  const validateCustomerData = () => {
    const errors: Record<string, string> = {};

    if (!customerData.name.trim()) {
      errors.name = t("validationNameRequired");
    }

    if (!validateEmail(customerData.email)) {
      errors.email = t("validationInvalidEmail");
    }

    if (!validatePhone(customerData.phone)) {
      errors.phone = t("validationInvalidPhone");
    }

    const docValidation = validateDocument(customerData.dni);
    if (!docValidation.isValid) {
      errors.dni = t("validationInvalidDocument");
    }

    if (!acceptedTerms) {
      errors.terms = t("validationTermsRequired");
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBikeSelection = (
    model: BikeModel,
    size: string,
    quantity: number
  ) => {
    const existingIndex = selectedBikes.findIndex(
      (bike) => bike.title_es === model.title_es && bike.size === size
    );

    if (quantity === 0) {
      if (existingIndex >= 0) {
        setSelectedBikes(
          selectedBikes.filter((_, index) => index !== existingIndex)
        );
      }
      return;
    }

    const sizeInfo = model.availableSizes.find((s) => s.size === size);
    if (!sizeInfo || quantity > sizeInfo.count) return;

    const selectedBikesForSize = sizeInfo.bikes.slice(0, quantity);

    if (existingIndex >= 0) {
      const updated = [...selectedBikes];
      updated[existingIndex] = {
        ...model,
        size,
        quantity,
        bikes: selectedBikesForSize,
      };
      setSelectedBikes(updated);
    } else {
      setSelectedBikes([
        ...selectedBikes,
        {
          ...model,
          size,
          quantity,
          bikes: selectedBikesForSize,
        },
      ]);
    }
  };

  const handleAccessorySelection = (accessory: Accessory) => {
    const existingIndex = selectedAccessories.findIndex(
      (a) => a.id === accessory.id
    );

    if (existingIndex >= 0) {
      setSelectedAccessories(
        selectedAccessories.filter((_, index) => index !== existingIndex)
      );
    } else {
      setSelectedAccessories([...selectedAccessories, accessory]);
    }
  };

  const handleInsuranceChange = (checked: boolean) => {
    setHasInsurance(checked);
  };

  const calculateTotal = (): number => {
    if (!startDate || !endDate) return 0;

    const days = calculateTotalDays(
      new Date(startDate),
      new Date(endDate),
      pickupTime,
      returnTime
    );
    
    const bikeTotal = selectedBikes.reduce((total, bike) => {
      return total + calculatePrice(bike.category, days) * bike.quantity;
    }, 0);

    const accessoryTotal = selectedAccessories.reduce((total, accessory) => {
      return total + accessory.price * days;
    }, 0);

    const totalBikeCount = selectedBikes.reduce(
      (total, bike) => total + bike.quantity,
      0
    );
    const insuranceTotal = hasInsurance
      ? calculateInsurance(days) * totalBikeCount
      : 0;

    return bikeTotal + accessoryTotal + insuranceTotal;
  };

  const calculateTotalDeposit = (): number => {
    return selectedBikes.reduce((total, bike) => {
      return total + calculateDeposit(bike.category) * bike.quantity;
    }, 0);
  };

  const isDateDisabled = (date: Date): boolean => {
    const today = createLocalDate();
    
    if (date < today && !isSameDay(date, today)) {
      return true;
    }
    
    if (isSunday(date)) return true;
    
    return false;
  };

  const sendConfirmationEmail = async (reservationData: any) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: customerData.email,
          subject: t("reservationConfirmationSubject"),
          reservationData,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send confirmation email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      await supabase
        .from("email_errors")
        .insert({
          reservation_id: reservationData.id,
          error_type: "confirmation_email",
          error_data: JSON.stringify({
            customer: customerData.email,
            error: error instanceof Error ? error.message : String(error)
          })
        });
    }
  };

  const generateRedsysOrderId = () => {
    return Array.from({ length: 12 }, () => 
      Math.floor(Math.random() * 36).toString(36).toUpperCase()
    ).join('').replace(/[^A-Z0-9]/g, '0').slice(0, 12).padStart(12, '0');
  };

  const checkBikesAvailability = async (): Promise<{ available: boolean; unavailableBikes: string[] }> => {
  if (!startDate || !endDate || selectedBikes.length === 0) {
    return { available: false, unavailableBikes: [] };
  }

  try {
    const { data: overlappingReservations, error } = await supabase
      .from("reservations")
      .select("bikes, status")
      .or(
        `and(start_date.lte.${formatDate(endDate)},end_date.gte.${formatDate(startDate)})`
      )
      .in("status", ["confirmed", "in_process", "pending_payment"]);

    if (error) throw error;

    const reservedBikeIds = new Set<string>();
    overlappingReservations?.forEach((reservation) => {
      reservation.bikes.forEach((bike: any) => {
        bike.bike_ids?.forEach((id: string) => reservedBikeIds.add(id));
      });
    });

    const unavailableBikes = selectedBikes.flatMap(bike => 
      bike.bikes.filter(b => reservedBikeIds.has(b.id)).map(b => b.id)
    );

    return {
      available: unavailableBikes.length === 0,
      unavailableBikes
    };
  } catch (error) {
    console.error("Error checking bikes availability:", error);
    return { available: false, unavailableBikes: [] };
  }
};

  const handleSubmitReservation = async () => {
  if (!startDate || !endDate) return;

  setIsSubmitting(true);

  try {
    // 1. Validar datos del cliente
    if (!validateCustomerData()) {
      throw new Error(t("reservationValidationError"));
    }

    // 2. Verificar disponibilidad con detalle
    const { available, unavailableBikes } = await checkBikesAvailability();
    if (!available) {
      // Actualizar el listado de bicis disponibles
      await fetchAvailableBikes();
      
      // Crear mensaje de error específico
      const errorMessage = unavailableBikes.length > 0 
        ? t("specificBikesNoLongerAvailable", { count: unavailableBikes.length })
        : t("bikesNoLongerAvailable");
      
      setValidationErrors({
        ...validationErrors,
        bikes: errorMessage
      });
      
      // Mostrar bicicletas no disponibles
      const updatedSelectedBikes = selectedBikes.map(bike => ({
        ...bike,
        bikes: bike.bikes.filter(b => !unavailableBikes.includes(b.id))
      })).filter(bike => bike.bikes.length > 0);

      setSelectedBikes(updatedSelectedBikes);
      setCurrentStep("bikes");
      return;
    }

    // 3. Generar ID único para Redsys
    const redsysOrderId = generateRedsysOrderId();

    // 4. Preparar datos de bicicletas para la base de datos
    const bikesForDB = selectedBikes.map(bike => ({
      model: {
        title_es: bike.title_es,
        title_en: bike.title_en,
        title_nl: bike.title_nl,
        subtitle_es: bike.subtitle_es,
        subtitle_en: bike.subtitle_en,
        subtitle_nl: bike.subtitle_nl,
        category: bike.category,
      },
      size: bike.size,
      quantity: bike.quantity,
      bike_ids: bike.bikes.map(b => b.id),
      daily_price: calculatePrice(bike.category, 1)
    }));

    // 5. Preparar datos de accesorios
    const accessoriesForDB = selectedAccessories.map(acc => ({
      id: acc.id,
      name_es: acc.name_es,
      name_en: acc.name_en,
      name_nl: acc.name_nl,
      price: acc.price,
    }));

    // 6. Formatear fechas y horas
    const pickupDate = new Date(startDate);
    const returnDate = new Date(endDate);
    const [pickupHour, pickupMinute] = pickupTime.split(':').map(Number);
    const [returnHour, returnMinute] = returnTime.split(':').map(Number);
    
    pickupDate.setHours(pickupHour, pickupMinute, 0, 0);
    returnDate.setHours(returnHour, returnMinute, 0, 0);

    // 7. Calcular días totales
    const totalDays = calculateTotalDays(
      new Date(startDate),
      new Date(endDate),
      pickupTime,
      returnTime
    );

    // 8. Crear objeto de datos de reserva
    const reservationData = {
      customer_name: customerData.name.trim(),
      customer_email: customerData.email.toLowerCase().trim(),
      customer_phone: customerData.phone.trim(),
      customer_dni: customerData.dni.toUpperCase().trim(),
      start_date: pickupDate.toISOString(),
      end_date: returnDate.toISOString(),
      pickup_time: pickupTime,
      return_time: returnTime,
      total_days: totalDays,
      bikes: bikesForDB,
      accessories: accessoriesForDB,
      insurance: hasInsurance,
      total_amount: calculateTotal(),
      deposit_amount: calculateTotalDeposit(),
      paid_amount: 0,
      status: isAdminMode ? "confirmed" : "pending_payment",
      payment_gateway: "redsys",
      payment_status: "pending",
      payment_reference: redsysOrderId,
      redsys_order_id: redsysOrderId,
      redsys_merchant_code: process.env.NEXT_PUBLIC_REDSYS_MERCHANT_CODE || '999008881',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      locale: language
    };

    // 9. Crear reserva en Supabase
    const { data, error: insertError } = await supabase
      .from("reservations")
      .insert([reservationData])
      .select()
      .single();

    if (insertError) {
      console.error("Error creating reservation:", insertError);
      throw insertError;
    }

    setReservationId(data.id);

    // 10. Registrar en logs
    await supabase
      .from("reservation_logs")
      .insert({
        reservation_id: data.id,
        action: "created",
        status: reservationData.status,
        amount: reservationData.total_amount
      });

    // 11. Manejar flujo según modo (admin o usuario)
    if (isAdminMode) {
      await sendConfirmationEmail({
        ...reservationData,
        id: data.id,
        status: "confirmed"
      });
      setCurrentStep("confirmation");
    } else {
      setCurrentStep("payment");
    }

  } catch (error) {
    console.error("Error in reservation process:", error);
    const errorMessage = error instanceof Error ? error.message : t("reservationError");
    
    // Registrar error detallado
    await supabase
      .from("reservation_errors")
      .insert({
        error_type: "reservation_creation",
        error_data: JSON.stringify({
          customer: customerData.email,
          error: errorMessage,
          selected_bikes: selectedBikes.map(b => ({
            model: b.title_es,
            size: b.size,
            quantity: b.quantity,
            bike_ids: b.bikes.map(bike => bike.id)
          })),
          timestamp: new Date().toISOString()
        })
      });

    // Manejar error según contexto
    if (isAdminMode) {
      alert(`Error: ${errorMessage}`);
    } else if (errorMessage.includes("bikesNoLongerAvailable")) {
      // Ya manejado en el flujo principal
    } else {
      window.location.href = `/reserva-fallida?order=${reservationId || 'none'}&error=${encodeURIComponent(errorMessage)}`;
    }
  } finally {
    setIsSubmitting(false);
  }
};

  const getCategoryName = (category: BikeCategory): string => {
    switch (category) {
      case "ROAD":
        return t("road");
      case "ROAD_PREMIUM":
        return t("roadPremium");
      case "MTB":
        return t("mtb");
      case "CITY_BIKE":
        return t("cityBike");
      case "E_CITY_BIKE":
        return t("eCityBike");
      case "E_MTB":
        return t("eMtb");
      default:
        return category;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "dates":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {t("selectDates")}
                {isAdminMode && <Badge variant="secondary">Modo Admin</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StoreHoursNotice t={t} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    {t("startDate")}
                  </Label>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = createLocalDate(date);
                        if (isSunday(newDate)) {
                          return;
                        }
                        setStartDate(newDate);
                        if (endDate && newDate > endDate) {
                          const newEndDate = createLocalDate(addDays(newDate, 1));
                          setEndDate(newEndDate);
                        }
                        setPickupTime(isSaturday(newDate) ? "10:00" : "10:00");
                      }
                    }}
                    disabled={(date) => isDateDisabled(date)}
                    className="rounded-md border"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    {t("endDate")}
                  </Label>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = createLocalDate(date);
                        if (isSunday(newDate)) {
                          return;
                        }
                        if (startDate && newDate <= startDate) {
                          return;
                        }
                        setEndDate(newDate);
                        setReturnTime(isSaturday(newDate) ? "14:00" : "18:00");
                      }
                    }}
                    disabled={(date) => {
                      const today = createLocalDate();
                      const selectedDate = date ? createLocalDate(date) : new Date();
                      
                      if (selectedDate < today) return true;
                      
                      if (isSunday(selectedDate)) return true;
                      
                      if (startDate && selectedDate <= startDate) return true;
                      
                      return false;
                    }}
                    className="rounded-md border"
                  />
                </div>
              </div>

              {startDate && endDate && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      {t("pickupTime")}
                    </Label>
                    <Select
                      value={pickupTime}
                      onValueChange={setPickupTime}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getTimeOptions(isSaturday(startDate)).map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      {t("returnTime")}
                    </Label>
                    <Select
                      value={returnTime}
                      onValueChange={setReturnTime}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getTimeOptions(isSaturday(endDate)).map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {startDate && endDate && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>{t("duration")}:</strong>{" "}
                    {calculateTotalDays(
                      new Date(startDate),
                      new Date(endDate),
                      pickupTime,
                      returnTime
                    )}{" "}
                    {t("days")}
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>{t("from")}:</strong>{" "}
                    {formatDateForDisplay(startDate, language)} {pickupTime} <strong>{t("to")}:</strong>{" "}
                    {formatDateForDisplay(endDate, language)} {returnTime}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <Button
                  onClick={() => setCurrentStep("bikes")}
                  disabled={!startDate || !endDate}
                  className="w-full"
                >
                  {t("continue")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case "bikes":
        const groupedModels = bikeModels.reduce(
          (acc, model) => {
            if (!acc[model.category]) {
              acc[model.category] = [];
            }
            acc[model.category].push(model);
            return acc;
          },
          {} as Record<string, BikeModel[]>
        );

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t("selectBikes")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {validationErrors.bikes && (
                <div className="bg-red-50 p-4 rounded-lg mb-4">
                  <p className="text-red-600">{validationErrors.bikes}</p>
                </div>
              )}
              
              <StoreHoursNotice t={t} />
              
              {isLoadingBikes ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {Object.entries(groupedModels).map(([category, models]) => (
                    <div key={category} className="mb-8">
                      <h3 className="text-lg font-semibold mb-4">
                        {getCategoryName(category as BikeCategory)}
                      </h3>

                      {models.map((model, modelIndex) => (
                        <div
                          key={`${model.title_es}-${modelIndex}`}
                          className="mb-6 p-4 border rounded-lg"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Bike className="h-8 w-8 text-gray-400" />
                              </div>
                              <div>
                                <h4 className="font-semibold">
                                  {translateBikeContent(
                                    {
                                      es: model.title_es,
                                      en: model.title_en,
                                      nl: model.title_nl,
                                    },
                                    language
                                  )}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {translateBikeContent(
                                    {
                                      es: model.subtitle_es,
                                      en: model.subtitle_en,
                                      nl: model.subtitle_nl,
                                    },
                                    language
                                  )}
                                </p>
                                <p className="text-sm font-medium text-green-600">
                                  {calculatePrice(
                                    model.category,
                                    calculateTotalDays(
                                      new Date(startDate!),
                                      new Date(endDate!),
                                      pickupTime,
                                      returnTime
                                    )
                                  )}
                                  {t("euro")}
                                  {t("perDay")}
                                </p>
                              </div>
                            </div>

                            <div className="lg:col-span-2">
                              <Label className="text-sm font-medium mb-2 block">
                                {t("availableSize")}
                              </Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {model.availableSizes.map((sizeInfo) => {
                                  const selectedBike = selectedBikes.find(
                                    (b) =>
                                      b.title_es === model.title_es &&
                                      b.size === sizeInfo.size
                                  );
                                  const currentQuantity =
                                    selectedBike?.quantity || 0;

                                  return (
                                    <div
                                      key={sizeInfo.size}
                                      className="border rounded-lg p-3"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">
                                          {t("size")} {sizeInfo.size}
                                        </span>
                                        <Badge variant="outline">
                                          {sizeInfo.count} {t("available")}
                                        </Badge>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleBikeSelection(
                                              model,
                                              sizeInfo.size,
                                              Math.max(0, currentQuantity - 1)
                                            )
                                          }
                                          disabled={currentQuantity === 0}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>

                                        <span className="w-8 text-center font-medium">
                                          {currentQuantity}
                                        </span>

                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleBikeSelection(
                                              model,
                                              sizeInfo.size,
                                              currentQuantity + 1
                                            )
                                          }
                                          disabled={
                                            currentQuantity >= sizeInfo.count
                                          }
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>

                                      {currentQuantity > 0 && (
                                        <div className="mt-2 text-xs text-green-600">
                                          {t("total")}:{" "}
                                          {calculatePrice(
                                            model.category,
                                            calculateTotalDays(
                                              new Date(startDate!),
                                              new Date(endDate!),
                                              pickupTime,
                                              returnTime
                                            )
                                          ) * currentQuantity}
                                          {t("euro")}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {selectedBikes.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold mb-2">
                        {t("selectedBikes")}:
                      </h4>
                      {selectedBikes.map((bike, index) => (
                        <p key={index} className="text-sm">
                          {translateBikeContent(
                            {
                              es: bike.title_es,
                              en: bike.title_en,
                              nl: bike.title_nl,
                            },
                            language
                          )}{" "}
                          - {t("size")} {bike.size} x {bike.quantity}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("dates")}
                    >
                      {t("back")}
                    </Button>
                    <Button
                      onClick={() => setCurrentStep("accessories")}
                      disabled={selectedBikes.length === 0}
                      className="flex-1"
                    >
                      {t("continue")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );

      case "accessories":
        return (
          <Card>
            <CardHeader>
              <CardTitle>{t("accessoriesInsurance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StoreHoursNotice t={t} />
              
              {isLoadingAccessories ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse flex items-center space-x-3 p-3 border rounded-lg"
                    >
                      <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-4">
                      {t("availableAccessories")}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {accessories.map((accessory) => (
                        <div
                          key={accessory.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg"
                        >
                          <Checkbox
                            id={accessory.id}
                            checked={selectedAccessories.some(
                              (a) => a.id === accessory.id
                            )}
                            onCheckedChange={() =>
                              handleAccessorySelection(accessory)
                            }
                          />
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                              <div className="flex-1">
                                <Label
                                  htmlFor={accessory.id}
                                  className="font-medium"
                                >
                                  {translateBikeContent(
                                    {
                                      es: accessory.name_es,
                                      en: accessory.name_en,
                                      nl: accessory.name_nl,
                                    },
                                    language
                                  )}
                                </Label>
                                <p className="text-sm text-gray-600">
                                  {accessory.price}
                                  {t("euro")}
                                  {t("perDay")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t pt-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="insurance"
                            checked={hasInsurance}
                            onCheckedChange={(checked) =>
                              handleInsuranceChange(checked as boolean)
                            }
                          />
                          <Label htmlFor="insurance" className="font-medium">
                            {t("additionalInsurance")} - {INSURANCE_PRICE_PER_DAY}
                            {t("euro")} {t("perDay")} {t("perBike")} (max{" "}
                            {INSURANCE_MAX_PRICE}
                            {t("euro")} {t("perBike")})
                          </Label>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {t("completeProtectionDamage")}
                        </p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">{t("orderSummary")}</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>
                              {t("bikes")} (
                              {selectedBikes.reduce(
                                (total, bike) => total + bike.quantity,
                                0
                              )}
                              )
                            </span>
                            <span>
                              {selectedBikes.reduce(
                                (total: number, bike: SelectedBike) =>
                                  total +
                                  calculatePrice(
                                    bike.category,
                                    calculateTotalDays(
                                      new Date(startDate!),
                                      new Date(endDate!),
                                      pickupTime,
                                      returnTime
                                    ) * bike.quantity
                                  ),
                                0
                              )}
                              {t("euro")}
                            </span>
                          </div>
                          {selectedAccessories.length > 0 && (
                            <div className="flex justify-between">
                              <span>{t("accessories")}</span>
                              <span>
                                {selectedAccessories.reduce(
                                  (total, acc) => 
                                    total + acc.price * calculateTotalDays(
                                      new Date(startDate!),
                                      new Date(endDate!),
                                      pickupTime,
                                      returnTime
                                    ),
                                  0
                                )}
                                {t("euro")}
                              </span>
                            </div>
                          )}
                          {hasInsurance && (
                            <div className="flex justify-between">
                              <span>{t("insurance")}</span>
                              <span>
                                {calculateInsurance(
                                  calculateTotalDays(
                                    new Date(startDate!),
                                    new Date(endDate!),
                                    pickupTime,
                                    returnTime
                                  )
                                ) * selectedBikes.reduce(
                                  (total, bike) => total + bike.quantity,
                                  0
                                )}
                                {t("euro")}
                              </span>
                            </div>
                          )}
                          <div className="border-t pt-1 flex justify-between font-semibold">
                            <span>{t("total")}</span>
                            <span>
                              {calculateTotal()}
                              {t("euro")}
                            </span>
                          </div>
                          <div className="flex justify-between text-orange-600">
                            <span>{t("depositCash")}</span>
                            <span>
                              {calculateTotalDeposit()}
                              {t("euro")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-4">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentStep("bikes")}
                        >
                          {t("back")}
                        </Button>
                        <Button
                          onClick={() => setCurrentStep("customer")}
                          className="flex-1"
                        >
                          {t("continue")}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

          case "customer":
            return (
              <Card>
                <CardHeader>
                  <CardTitle>{t("customerData")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <StoreHoursNotice t={t} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">{t("fullName")} *</Label>
                      <Input
                        id="name"
                        value={customerData.name}
                        onChange={(e) => {
                          setCustomerData({
                            ...customerData,
                            name: e.target.value,
                          });
                          if (validationErrors.name) {
                            setValidationErrors({ ...validationErrors, name: "" });
                          }
                        }}
                        className={validationErrors.name ? "border-red-500" : ""}
                      />
                      {validationErrors.name && (
                        <p className="text-red-500 text-sm mt-1">
                          {validationErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email">{t("email")} *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={customerData.email}
                        onChange={(e) => {
                          setCustomerData({
                            ...customerData,
                            email: e.target.value,
                          });
                          if (validationErrors.email) {
                            setValidationErrors({ ...validationErrors, email: "" });
                          }
                        }}
                        className={validationErrors.email ? "border-red-500" : ""}
                      />
                      {validationErrors.email && (
                        <p className="text-red-500 text-sm mt-1">
                          {validationErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phone">{t("phone")} *</Label>
                      <Input
                        id="phone"
                        value={customerData.phone}
                        onChange={(e) => {
                          setCustomerData({
                            ...customerData,
                            phone: e.target.value,
                          });
                          if (validationErrors.phone) {
                            setValidationErrors({ ...validationErrors, phone: "" });
                          }
                        }}
                        className={validationErrors.phone ? "border-red-500" : ""}
                        placeholder="+34 XXX XXX XXX"
                      />
                      {validationErrors.phone && (
                        <p className="text-red-500 text-sm mt-1">
                          {validationErrors.phone}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="dni">{t("dniPassport")} *</Label>
                      <Input
                        id="dni"
                        value={customerData.dni}
                        onChange={(e) => {
                          setCustomerData({ ...customerData, dni: e.target.value });
                          if (validationErrors.dni) {
                            setValidationErrors({ ...validationErrors, dni: "" });
                          }
                        }}
                        className={validationErrors.dni ? "border-red-500" : ""}
                        placeholder="12345678A / X1234567A / AB123456"
                      />
                      {validationErrors.dni && (
                        <p className="text-red-500 text-sm mt-1">
                          {validationErrors.dni}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {t("validationValidDocumentInfo")}
                      </p>
                    </div>
                  </div>

                  <RentalTermsCheckbox 
                    t={t}
                    acceptedTerms={acceptedTerms}
                    setAcceptedTerms={setAcceptedTerms}
                    validationErrors={validationErrors}
                    setValidationErrors={setValidationErrors}
                    language={language}
                  />

                  <div className="mt-6 flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("accessories")}
                    >
                      {t("back")}
                    </Button>
                    <Button
                      onClick={() => {
                        if (validateCustomerData()) {
                          handleSubmitReservation();
                        }
                      }}
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? t("processing")
                        : isAdminMode
                          ? t("reservationCreate")
                          : t("continuePayment")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );

          case "payment":
            if (isAdminMode) {
              return null;
            }

            return (
              <div className="space-y-6">
                <StoreHoursNotice t={t} />
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>{t("important")}:</strong>{" "}
                    {t("depositMessage", { amount: calculateTotalDeposit() })}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">{t("finalSummary")}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{t("payWithCard")}</span>
                      <span className="font-semibold">
                        {calculateTotal()}
                        {t("euro")}
                      </span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>{t("depositInStore")}</span>
                      <span>
                        {calculateTotalDeposit()}
                        {t("euro")}
                      </span>
                    </div>
                  </div>
                </div>

                <PaymentForm
                  amount={calculateTotal()}
                  t={t}
                  onBack={() => setCurrentStep("customer")}
                  reservationId={reservationId}
                  customerData={customerData}
                />
              </div>
            );

          case "confirmation":
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    {t("reservationConfirmed")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <p className="text-lg">{t("reservationSuccess")}</p>
                    <p className="text-sm text-gray-600">
                      {t("reservationNumber")}: <strong>{reservationId}</strong>
                    </p>
                    {!isAdminMode && (
                      <p className="text-sm text-gray-600">
                        {t("emailSent")} {customerData.email}
                      </p>
                    )}

                    <div className="bg-green-50 p-4 rounded-lg mt-6">
                      <h4 className="font-semibold mb-2">{t("nextSteps")}</h4>
                      <ul className="text-sm text-left space-y-1">
                        <li>{t("comeToStore")}</li>
                        <li>{t("bringDocuments")}</li>
                        <li>{t("reviewBikes")}</li>
                      </ul>
                    </div>

                    <div className="flex gap-4 mt-6">
                      {isAdminMode ? (
                        <>
                          <Button
                            onClick={() => window.location.reload()}
                            className="flex-1"
                          >
                            {t("reservationNew")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => window.close()}
                            className="flex-1"
                          >
                            {t("reservationClose")}
                          </Button>
                        </>
                      ) : (
                        <Button asChild className="w-full">
                          <a href="/">{t("backToHome")}</a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

          default:
            return null;
        }
      };

      return (
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {t("reserveBikes")}{" "}
                {isAdminMode && <Badge variant="secondary">Modo Admin</Badge>}
              </h1>

              <div className="flex items-center flex-nowrap gap-2 md:gap-4 mb-8 overflow-x-auto sm:overflow-x-visible sm:justify-between">
                {[
                  { key: "dates", label: t("dates"), icon: CalendarDays },
                  { key: "bikes", label: t("bikes"), icon: ShoppingCart },
                  {
                    key: "accessories",
                    label: t("accessories"),
                    icon: ShoppingCart,
                  },
                  { key: "customer", label: t("data"), icon: CreditCard },
                  ...(isAdminMode
                    ? []
                    : [{ key: "payment", label: t("payment"), icon: CreditCard }]),
                  {
                    key: "confirmation",
                    label: t("confirmation"),
                    icon: CheckCircle,
                  },
                ].map((step, index, array) => {
                  const Icon = step.icon;
                  const isActive = currentStep === step.key;
                  const stepKeys = array.map((s) => s.key);
                  const currentIndex = stepKeys.indexOf(currentStep);
                  const stepIndex = stepKeys.indexOf(step.key);
                  const isCompleted = currentIndex > stepIndex;

                  return (
                    <div
                      key={step.key}
                      className="flex items-center flex-shrink-0 min-w-[120px]"
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          isActive
                            ? "bg-green-600 text-white"
                            : isCompleted
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-200 text-gray-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={`ml-2 text-xs sm:text-sm whitespace-nowrap ${
                          isActive
                            ? "text-green-600 font-medium"
                            : isCompleted
                              ? "text-green-600"
                              : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      {index < array.length - 1 && (
                        <div
                          className="hidden sm:block w-4 h-0.5 mx-2 bg-gray-200 sm:w-8 sm:mx-4 sm:bg-gray-200"
                          style={{ minWidth: 8 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {renderStepContent()}
          </div>
        </div>
      );
    }