"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, isSameDay, isSunday, isSaturday } from "date-fns";
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe, StripeElements, PaymentIntent } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Components
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
declare module '@stripe/stripe-js' {
  interface PaymentIntent {
    metadata: {
      [key: string]: string;
    };
  }
}

// Icons
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

// Libs
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { TranslationKey } from "@/lib/translations";
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
  validateName,
} from "@/lib/validation";

const convertToMadridTime = (date: Date): Date => {
  const madridTimeZone = "Europe/Madrid";
  const utcDate = new Date(date.toISOString());
  const localString = utcDate.toLocaleString("en-US", { timeZone: madridTimeZone });
  return new Date(localString);
};

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
  pricePerDay?: number;
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

const calculateTotalDays = (start: Date, end: Date, pickup: string, returnTime: string): number => {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (isSameDay(startDay, endDay)) return 1;

  const diffDays = Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));

  if (returnTime <= pickup) {
    return diffDays;
  }

  return diffDays + 1;
};

const calculateTotalDeposit = (bikes: SelectedBike[]): number => {
  return bikes.reduce((total: number, bike: SelectedBike) => {
    return total + calculateDeposit(bike.category) * bike.quantity;
  }, 0);
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

const InsuranceContractCheckbox = ({ 
  t, 
  hasInsurance, 
  handleInsuranceChange,
  language
}: { 
  t: (key: TranslationKey) => string,
  hasInsurance: boolean,
  handleInsuranceChange: (checked: boolean) => void,
  language: string
}) => {
 const handleDownloadInsuranceContract = () => {
  const pdfFiles = {
    es: '/insurance/insurance_contract_es.pdf',
    en: '/insurance/insurance_contract_en.pdf',
    nl: '/insurance/insurance_contract_nl.pdf'
  };
  
  const link = document.createElement('a');
  link.href = pdfFiles[language as keyof typeof pdfFiles];
  link.download = `insurance_contract_${language}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

  return (
    <div className="mt-4">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="insurance"
              checked={hasInsurance}
              onCheckedChange={(checked) => handleInsuranceChange(checked as boolean)}
            />
            <Label htmlFor="insurance" className="font-medium">
              {t("additionalInsurance")} - {INSURANCE_PRICE_PER_DAY}
              {t("euro")} {t("perDay")} (max {INSURANCE_MAX_PRICE}
              {t("euro")})
            </Label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 hover:text-blue-800"
              onClick={handleDownloadInsuranceContract}
            >
              <Download className="h-4 w-4 mr-1" />
              {t("downloadInsuranceContract")}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            {t("completeProtectionDamage")}
          </p>
        </div>
      </div>
    </div>
  );
};

const StripePaymentForm = ({ 
  clientSecret,
  customerData,
  calculateTotal,
  setCurrentStep,
  setPaymentError,
  sendConfirmationEmail,
  setSelectedBikes,
  setClientSecret,
  language,
  selectedBikes = [],
  selectedAccessories = [],
  hasInsurance = false,
  startDate,
  endDate,
  pickupTime,
  t,
  returnTime
}: { 
  clientSecret: string;
  customerData: { name: string; email: string; phone: string; dni: string };
  calculateTotal: () => number;
  setCurrentStep: React.Dispatch<React.SetStateAction<Step>>;
  setPaymentError: (error: string | null) => void;
  sendConfirmationEmail: (data: any) => Promise<void>;
  setSelectedBikes: React.Dispatch<React.SetStateAction<SelectedBike[]>>;
  setClientSecret: React.Dispatch<React.SetStateAction<string | null>>;
  language: string;
  selectedBikes?: SelectedBike[];
  selectedAccessories?: Accessory[];
  hasInsurance?: boolean;
  startDate: Date;
  endDate: Date;
  pickupTime: string;
  returnTime: string;
  t: (key: TranslationKey) => string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedIntent, setConfirmedIntent] = useState<any>(null);
  
  // Calculamos el monto total a pagar (sin restar el depósito)
  const totalAmount = calculateTotal();

  const createReservation = async (metadata: any, paymentIntentId: string) => {
    try {
      const bikesData = (selectedBikes || []).map((bike: any) => ({
        model: bike.title_es,
        size: bike.size,
        quantity: bike.quantity,
        bike_ids: bike.bikes.map((b: any) => b.id),
        pricePerDay: calculatePrice(bike.category, calculateTotalDays(startDate, endDate, pickupTime, returnTime))
      }));

      const { data, error } = await supabase
        .from("reservations")
        .insert([{
          customer_name: metadata.customer_name || customerData.name,
          customer_email: metadata.customer_email || customerData.email,
          customer_phone: metadata.customer_phone || customerData.phone,
          customer_dni: metadata.customer_dni || customerData.dni,
          start_date: metadata.start_date || startDate.toISOString(),
          end_date: metadata.end_date || endDate.toISOString(),
          pickup_time: metadata.pickup_time || pickupTime,
          return_time: metadata.return_time || returnTime,
          total_days: parseInt(metadata.total_days || calculateTotalDays(startDate, endDate, pickupTime, returnTime).toString()),
          bikes: bikesData,
          accessories: selectedAccessories || [],
          insurance: metadata.insurance ? metadata.insurance === "true" : hasInsurance,
          total_amount: parseFloat(metadata.total_amount || totalAmount.toString()),
          deposit_amount: parseFloat(metadata.deposit_amount || calculateTotalDeposit(selectedBikes).toString()),
          paid_amount: parseFloat(metadata.total_amount || totalAmount.toString()),
          status: "confirmed",
          payment_gateway: "stripe",
          payment_status: "paid",
          payment_reference: paymentIntentId,
          stripe_payment_intent_id: paymentIntentId,
          locale: metadata.locale || language
        }])
        .select()
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      //console.error("Error creating reservation:", error);
      throw error;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      setCardError("Payment system not ready. Please reload the page.");
      return;
    }

    setIsProcessing(true);
    setCardError(null);
    setPaymentError(null);

    try {
      const { paymentIntent: currentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      
      if (!currentIntent || currentIntent.status !== 'requires_payment_method') {
        throw { 
          code: 'payment_intent_unexpected_state',
          message: 'Payment session expired. Please restart the process.' 
        };
      }

      const { error: stripeError, paymentIntent: confirmedPaymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: customerData.name,
            email: customerData.email,
            phone: customerData.phone
          },
        },
        receipt_email: customerData.email
      });

      if (stripeError) throw stripeError;

      setConfirmedIntent(confirmedPaymentIntent);

      if (confirmedPaymentIntent?.status === "succeeded") {
        const reservationMetadata = {
          customer_name: customerData.name,
          customer_email: customerData.email,
          customer_phone: customerData.phone,
          customer_dni: customerData.dni,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          pickup_time: pickupTime,
          return_time: returnTime,
          total_days: calculateTotalDays(startDate, endDate, pickupTime, returnTime).toString(),
          bikes: JSON.stringify((selectedBikes || []).map(bike => ({
            model: bike.title_es,
            size: bike.size,
            quantity: bike.quantity,
            bike_ids: bike.bikes.map((b: any) => b.id),
            pricePerDay: calculatePrice(bike.category, calculateTotalDays(startDate, endDate, pickupTime, returnTime))
          }))),
          accessories: JSON.stringify(selectedAccessories || []),
          insurance: hasInsurance.toString(),
          total_amount: totalAmount.toString(),
          deposit_amount: calculateTotalDeposit(selectedBikes).toString(),
          locale: language
        };

        const reservationData = await createReservation(
          { ...reservationMetadata, ...(confirmedPaymentIntent.metadata || {}) },
          confirmedPaymentIntent.id
        );

        await sendConfirmationEmail({
          ...reservationData,
          payment_reference: confirmedPaymentIntent.id
        });

        setCurrentStep("confirmation");
      }
    } catch (err: any) {
      //console.error("Payment Error:", {
        //error: err,
        //paymentIntentId: confirmedIntent?.id,
        //paymentStatus: confirmedIntent?.status
     // });

      const errorMessage = err.code === 'payment_intent_unexpected_state' 
        ? "Payment session expired. Please restart the checkout process."
        : err.message || "Payment processing failed. Please try again.";
      
      setCardError(errorMessage);
      setPaymentError(errorMessage);
      
      if (err.code === 'payment_intent_unexpected_state') {
        setClientSecret(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded-lg">
        Error: Payment session expired. Please restart the process.
      </div>
    );
  }

  if (!stripe || !elements) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">Loading payment system...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border p-4 rounded-lg">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
              invalid: {
                color: "#9e2146",
              },
            },
          }}
        />
      </div>

      {cardError && (
        <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
          {cardError}
        </div>
      )}

     

      <Button
        type="submit"
        disabled={isProcessing || !stripe}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isProcessing ? (
          <>
            <Loader2 className="animate-spin h-4 w-4 mr-2" />
            {t("processingPayment")}
          </>
        ) : (
          `${t("payOnline")} ${totalAmount.toFixed(2)}€`
        )}
      </Button>

      <div className="mt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep("customer")}
          className="w-full"
          type="button"
        >
          {t("goBack")}
        </Button>
      </div>
    </form>
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
  const [returnTime, setReturnTime] = useState("10:00"); // Changed default to match pickup time
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
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reservationData, setReservationData] = useState<any>(null);

 useEffect(() => {
  const fetchAccessories = async () => {
    setIsLoadingAccessories(true);
    try {
      const { data, error } = await supabase
        .from("accessories")
        .select("*")
        .eq("available", true);
      
      //console.log("Datos de accesorios:", data); // ← Añade esto
      //console.log("Error:", error); // ← Añade esto

      if (error) {
        throw error;
      }
      if (data) {
        setAccessories(data);
      }
    } catch (error) {
      //console.error("Error fetching accessories:", error);
    } finally {
      setIsLoadingAccessories(false);
    }
  };
  fetchAccessories();
}, []);

  useEffect(() => {
  if (startDate && endDate) {
    // Solo establecer valores por defecto si no hay horas seleccionadas
    if (!pickupTime) {
      setPickupTime(isSaturday(startDate) ? "10:00" : "10:00");
    }
    if (!returnTime) {
      setReturnTime(pickupTime || (isSaturday(endDate) ? "10:00" : "10:00"));
    }

    fetchAvailableBikes();
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

      const { data: reservations, error: resError } = await supabase
        .from("reservations")
        .select("bikes, start_date, end_date, pickup_time, return_time, status")
        .or(`and(start_date.lte.${formatDate(endDate)},end_date.gte.${formatDate(startDate)})`)
        .in("status", ["confirmed", "in_process"]);

      if (resError) throw resError;

      const reservedBikeIds = new Set<string>();

      const selStart = convertToMadridTime(new Date(startDate));
      selStart.setHours(Number(pickupTime.split(':')[0]), Number(pickupTime.split(':')[1]));

      const selEnd = convertToMadridTime(new Date(endDate));
      selEnd.setHours(Number(returnTime.split(':')[0]), Number(returnTime.split(':')[1]));

      reservations.forEach(res => {
        const resStart = convertToMadridTime(new Date(res.start_date));
        resStart.setHours(Number(res.pickup_time.split(':')[0]), Number(res.pickup_time.split(':')[1]));

        const resEnd = convertToMadridTime(new Date(res.end_date));
        resEnd.setHours(Number(res.return_time.split(':')[0]), Number(res.return_time.split(':')[1]));

        const overlap = selStart < resEnd && selEnd > resStart;

        if (overlap) {
          markBikesAsReserved(res.bikes, reservedBikeIds);
        }
      });

      const filtered = allBikes.filter(b => !reservedBikeIds.has(b.id.trim()));
      //console.log("✅ Bicis disponibles:", filtered.map(b => b.id));
      //console.log("❌ Bicis bloqueadas:", [...reservedBikeIds]);
      setAvailableBikes(filtered);

    } catch (err) {
      //console.error("Error al cargar bicis:", err);
    } finally {
      setIsLoadingBikes(false);
    }
  };

  const markBikesAsReserved = (bikesData: any, reservedBikeIds: Set<string>) => {
    try {
      const bikes = typeof bikesData === 'string' ? JSON.parse(bikesData) : bikesData;

      if (!Array.isArray(bikes)) return;

      for (const bike of bikes) {
        const ids = Array.isArray(bike.bike_ids) ? bike.bike_ids : [];
        for (const id of ids) {
          if (typeof id === 'string') {
            reservedBikeIds.add(id.trim());
          }
        }
      }
    } catch (err) {
      //console.error("❌ Error parseando bikes:", bikesData, err);
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
    } else if (!validateName(customerData.name)) {
      errors.name = t("validationInvalidName");
    }

    if (!customerData.email.trim()) {
      errors.email = t("validationEmailRequired");
    } else if (!validateEmail(customerData.email)) {
      errors.email = t("validationInvalidEmail");
    }

    if (!customerData.phone.trim()) {
      errors.phone = t("validationPhoneRequired");
    } else if (!validatePhone(customerData.phone)) {
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

 // En la función calculateTotal, asegurarnos de que nunca devuelva 0
const calculateTotal = (): number => {
  if (!startDate || !endDate || selectedBikes.length === 0) {
    throw new Error("No se han seleccionado bicicletas o fechas"); // ← Esto no debería ocurrir si el flujo está bien controlado
  }

  const days = calculateTotalDays(startDate, endDate, pickupTime, returnTime);
  
  // Bicicletas (siempre hay al menos 1)
  const bikeTotal = selectedBikes.reduce((total, bike) => {
    const price = calculatePrice(bike.category, days);
    return total + (price * bike.quantity);
  }, 0);

  // Accesorios (manejar posibles valores null)
  const accessoryTotal = selectedAccessories.reduce((total, acc) => {
    return total + (acc.price || 0); // ← Maneja null como 0
  }, 0);

  // Seguro (opcional)
  const insuranceTotal = hasInsurance
    ? calculateInsurance(days) * selectedBikes.reduce((t, b) => t + b.quantity, 0)
    : 0;

  const total = bikeTotal + accessoryTotal + insuranceTotal;
  
  if (total < 0) {
    throw new Error("El total no puede ser negativo");
}


  return total;
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
          subject: t("reservationConfirmed"),
          reservationData,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send confirmation email");
      }
    } catch (error) {
      //console.error("Error sending email:", error);
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

  const checkBikesAvailability = async (): Promise<{ available: boolean; unavailableBikes: string[] }> => {
    if (!startDate || !endDate || selectedBikes.length === 0) {
      return { available: false, unavailableBikes: [] };
    }

    try {
      const { data: overlappingReservations, error } = await supabase
        .from("reservations")
        .select("bikes, start_date, end_date, pickup_time, return_time, status")
        .or(`and(start_date.lte.${formatDate(endDate)},end_date.gte.${formatDate(startDate)})`)
        .in("status", ["confirmed", "in_process"]);

      if (error) throw error;

      const reservedBikeIds = new Set<string>();
      const selectedBikeIds = new Set<string>(selectedBikes.flatMap(b => b.bikes.map(bike => bike.id)));

      const selStart = convertToMadridTime(new Date(startDate));
      selStart.setHours(Number(pickupTime.split(':')[0]), Number(pickupTime.split(':')[1]));

      const selEnd = convertToMadridTime(new Date(endDate));
      selEnd.setHours(Number(returnTime.split(':')[0]), Number(returnTime.split(':')[1]));

      overlappingReservations?.forEach(reservation => {
        const resStart = convertToMadridTime(new Date(reservation.start_date));
        resStart.setHours(Number(reservation.pickup_time.split(':')[0]), Number(reservation.pickup_time.split(':')[1]));

        const resEnd = convertToMadridTime(new Date(reservation.end_date));
        resEnd.setHours(Number(reservation.return_time.split(':')[0]), Number(reservation.return_time.split(':')[1]));

        const overlaps = selStart < resEnd && selEnd > resStart;

        if (overlaps) {
          markBikesAsReserved(reservation.bikes, reservedBikeIds);
        }
      });

      const unavailableBikes = Array.from(selectedBikeIds).filter(id => reservedBikeIds.has(id));

      return {
        available: unavailableBikes.length === 0,
        unavailableBikes
      };
    } catch (error) {
      //console.error("Error checking bikes availability:", error);
      return { available: false, unavailableBikes: [] };
    }
  };
const handleSubmitReservation = async () => {
  setIsSubmitting(true);
  setPaymentError(null);

  try {
    if (!validateCustomerData()) {
      throw new Error("Completa todos los campos requeridos");
    }

    const { available } = await checkBikesAvailability();
    if (!available) {
      throw new Error("Algunas bicicletas ya no están disponibles");
    }

    // 🔒 Cálculo seguro de días de alquiler
    const days = calculateTotalDays(startDate, endDate, pickupTime, returnTime);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error("La duración del alquiler no es válida");
    }

    // Cálculo correcto del precio por días reales
    const bikeSubtotal = selectedBikes.reduce((total, bike) => {
  const pricePerDay = Number(calculatePrice(bike.category, days));
  const quantity = Number(bike.quantity);
  const subtotal = Number.isFinite(pricePerDay) && Number.isFinite(quantity)
    ? pricePerDay * days * quantity
    : 0;
  return total + subtotal;
}, 0);



    const accessoriesSubtotal = selectedAccessories.reduce((total, acc) => {
  const price = Number(acc.price);
  return total + (Number.isFinite(price) ? price : 0);
}, 0);


    const insuranceSubtotal = hasInsurance
  ? Math.min(
      INSURANCE_MAX_PRICE,
      INSURANCE_PRICE_PER_DAY * days
    ) * selectedBikes.reduce((total, bike) => {
      const quantity = Number(bike.quantity);
      return total + (Number.isFinite(quantity) ? quantity : 0);
    }, 0)
  : 0;


    const totalAmount = bikeSubtotal + accessoriesSubtotal + insuranceSubtotal;

    // Validación adicional del monto
    if (totalAmount <= 0) {
      throw new Error("El monto total debe ser mayor a 0");
    }

    // Convertir a céntimos y validar
    const amountInCents = Math.round(totalAmount * 100);
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error("El monto total no es válido");
    }

    // Simplificar los datos de bicicletas para la metadata (CORREGIDO)
    const simplifiedBikesData = selectedBikes.map(bike => ({
      model: bike.title_es.substring(0, 50),
      size: bike.size,
      quantity: bike.quantity,
      pricePerDay: calculatePrice(bike.category, days), // Usar days en lugar de 1
      totalPrice: calculatePrice(bike.category, days) * days * bike.quantity
    }));

    // Simplificar los accesorios
    const simplifiedAccessories = selectedAccessories.map(acc => ({
      id: acc.id,
      name: acc.name_es.substring(0, 50),
      price: acc.price
    }));

    const metadata = {
      customer_name: customerData.name.substring(0, 100),
      customer_email: customerData.email.substring(0, 100),
      customer_phone: customerData.phone.substring(0, 20),
      customer_dni: customerData.dni.substring(0, 20),
      start_date: startDate.toISOString().substring(0, 10),
      end_date: endDate.toISOString().substring(0, 10),
      pickup_time: pickupTime,
      return_time: returnTime,
      total_days: days.toString(),
      bikes_count: selectedBikes.reduce((total, bike) => total + bike.quantity, 0),
      accessories_count: selectedAccessories.length,
      insurance: hasInsurance ? "1" : "0",
      total_amount: totalAmount.toFixed(2),
      deposit_amount: calculateTotalDeposit().toFixed(2),
      locale: language,
      bikes_data: JSON.stringify(simplifiedBikesData),
      accessories_data: JSON.stringify(simplifiedAccessories)
    };

    const response = await fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInCents,
        currency: 'eur',
        metadata
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al crear el pago");
    }

    const { clientSecret } = await response.json();
    setClientSecret(clientSecret);
    setCurrentStep("payment");

  } catch (error: any) {
    setPaymentError(error.message || "Error al procesar el pago. Por favor, inténtelo de nuevo.");
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
              
              <div className="flex flex-col md:flex-row gap-8 w-full">
                <div className="w-full md:w-1/2">
                  <Label className="text-sm font-medium mb-2 block">
                    {t("startDate")}
                  </Label>
                  <div className="border rounded-lg p-0 bg-white overflow-hidden min-h-[320px]">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
  if (date) {
    const newDate = createLocalDate(date);
    if (isSunday(newDate)) return;
    setStartDate(newDate);
    if (endDate && newDate > endDate) {
      setEndDate(createLocalDate(addDays(newDate, 1)));
    }
  }
}}
                      disabled={(date) => isDateDisabled(date)}
                    />
                  </div>
                </div>
                
                <div className="w-full md:w-1/2">
                  <Label className="text-sm font-medium mb-2 block">
                    {t("endDate")}
                  </Label>
                  <div className="border rounded-lg p-0 bg-white overflow-hidden min-h-[320px]">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
  if (date) {
    const newDate = createLocalDate(date);
    if (isSunday(newDate)) return;
    if (startDate && newDate <= startDate) return;
    setEndDate(newDate);
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
                    />
                  </div>
                </div>
              </div>
            

              {startDate && endDate && (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                                {t("size")} {t("available")}
                              </Label>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("dates")}
                      className="w-full sm:w-auto"
                    >
                      {t("back")}
                    </Button>
                    <Button
                      onClick={() => setCurrentStep("accessories")}
                      disabled={selectedBikes.length === 0}
                      className="w-full sm:w-auto"
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
        const rentalDays = calculateTotalDays(
          new Date(startDate!),
          new Date(endDate!),
          pickupTime,
          returnTime
        );

        const bikeSubtotal = selectedBikes.reduce(
  (total, bike) => {
    const pricePerDay = calculatePrice(bike.category, rentalDays);
    return total + (pricePerDay * rentalDays * bike.quantity);
  },
  0
);

        const accessoriesSubtotal = selectedAccessories.reduce(
  (total, acc) => total + (acc.price ?? 0), // Maneja null como 0
  0
);

        const insuranceSubtotal = hasInsurance
          ? Math.min(
              INSURANCE_MAX_PRICE,
              INSURANCE_PRICE_PER_DAY * rentalDays
            ) * selectedBikes.reduce((total, bike) => total + bike.quantity, 0)
          : 0;

        const depositTotal = selectedBikes.reduce((total, bike) => {
  const deposit = Number(calculateDeposit(bike.category));
  const quantity = Number(bike.quantity);
  const subtotal = Number.isFinite(deposit) && Number.isFinite(quantity)
    ? deposit * quantity
    : 0;
  return total + subtotal;
}, 0);


        const orderTotal = bikeSubtotal + accessoriesSubtotal + insuranceSubtotal;

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
                    <div key={i} className="animate-pulse flex items-center space-x-3 p-3 border rounded-lg">
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
                    <h4 className="font-semibold mb-4">{t("accessories")}</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {accessories.map((accessory) => (
                        <div key={accessory.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            id={accessory.id}
                            checked={selectedAccessories.some((a) => a.id === accessory.id)}
                            onCheckedChange={() => handleAccessorySelection(accessory)}
                          />
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor={accessory.id} className="font-medium">
                              {translateBikeContent(
                                { es: accessory.name_es, en: accessory.name_en, nl: accessory.name_nl },
                                language
                              )}
                            </Label>
                           <p className="text-sm text-gray-600">
  {accessory.price ?? 0} {/* Esto maneja el caso null como 0 */}
  {t("euro")}
</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <InsuranceContractCheckbox 
                      t={t}
                      hasInsurance={hasInsurance}
                      handleInsuranceChange={handleInsuranceChange}
                      language={language}
                    />
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">{t("orderSummary")}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>
                          {t("bikes")} (
                          {selectedBikes.reduce((total, bike) => total + bike.quantity, 0)}
                          )
                        </span>
                        <span>
                          {bikeSubtotal}
                          {t("euro")}
                        </span>
                      </div>

                      {selectedAccessories.length > 0 && (
                        <div className="flex justify-between">
                          <span>{t("accessories")}</span>
                          <span>
                            {accessoriesSubtotal}
                            {t("euro")}
                          </span>
                        </div>
                      )}

                      {hasInsurance && (
                        <div className="flex justify-between">
                          <span>{t("insurance")}</span>
                          <span>
                            {insuranceSubtotal}
                            {t("euro")}
                          </span>
                        </div>
                      )}

                      <div className="border-t pt-1 flex justify-between font-semibold">
                        <span>{t("total")}</span>
                        <span>
                          {orderTotal}
                          {t("euro")}
                        </span>
                      </div>

                      <div className="flex justify-between text-orange-600">
                        <span>{t("depositCash")}</span>
                        <span>
                          {depositTotal}
                          {t("euro")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("bikes")}
                      className="w-full sm:w-auto"
                    >
                      {t("back")}
                    </Button>
                    <Button
                      onClick={() => setCurrentStep("customer")}
                      className="w-full sm:w-auto"
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
              
              <div className="grid grid-cols-1 gap-4">
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

              <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("accessories")}
                  className="w-full sm:w-auto"
                >
                  {t("back")}
                </Button>
                <Button
                  onClick={handleSubmitReservation}
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? t("processing")
                    : isAdminMode
                      ? t("continue")
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

  // 🔒 Cálculo seguro de días de alquiler
  const days = calculateTotalDays(
    new Date(startDate),
    new Date(endDate),
    pickupTime,
    returnTime
  );

  // Validación importante para evitar NaN/undefined
  if (!Number.isFinite(days) || days <= 0) {
    console.error("❌ Días de alquiler inválidos:", days, {
      startDate,
      endDate,
      pickupTime,
      returnTime
    });
    return (
      <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded-lg">
        Error: La duración del alquiler no es válida. Por favor, selecciona fechas válidas.
      </div>
    );
  }

  // Cálculo correcto del precio por días reales
  const bikeSubtotalPayment = selectedBikes.reduce((total, bike) => {
    const pricePerDay = calculatePrice(bike.category, days);
    return total + (pricePerDay * days * bike.quantity);
  }, 0);

  const accessoriesSubtotalPayment = selectedAccessories.reduce(
    (total, acc) => total + (acc.price ?? 0), // Maneja null como 0
    0
  );

  const insuranceSubtotalPayment = hasInsurance
    ? calculateInsurance(days) * selectedBikes.reduce((t, b) => t + b.quantity, 0)
    : 0;

  const orderTotalPayment = bikeSubtotalPayment + accessoriesSubtotalPayment + insuranceSubtotalPayment;

  // Validación adicional del monto
  if (orderTotalPayment <= 0) {
    console.error("❌ Monto total inválido:", orderTotalPayment);
    return (
      <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded-lg">
        Error: El monto total debe ser mayor a 0. Por favor, verifica tu selección.
      </div>
    );
  }

  const depositTotalPayment = selectedBikes.reduce(
    (total, bike) => total + calculateDeposit(bike.category) * bike.quantity,
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t("paymentDetails")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StoreHoursNotice t={t} />
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 className="font-semibold mb-2">{t("orderSummary")}</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>
                {t("bikes")} (
                {selectedBikes.reduce((total, bike) => total + bike.quantity, 0)}
                )
              </span>
              <span>
                {bikeSubtotalPayment.toFixed(2)}
                {t("euro")}
              </span>
            </div>

            {selectedAccessories.length > 0 && (
              <div className="flex justify-between">
                <span>{t("accessories")}</span>
                <span>
                  {accessoriesSubtotalPayment.toFixed(2)}
                  {t("euro")}
                </span>
              </div>
            )}

            {hasInsurance && (
              <div className="flex justify-between">
                <span>{t("insurance")}</span>
                <span>
                  {insuranceSubtotalPayment.toFixed(2)}
                  {t("euro")}
                </span>
              </div>
            )}

            <div className="border-t pt-1 flex justify-between font-semibold">
              <span>{t("total")}</span>
              <span>
                {orderTotalPayment.toFixed(2)}
                {t("euro")}
              </span>
            </div>

            <div className="flex justify-between text-orange-600">
              <span>{t("depositCash")}</span>
              <span>
                {depositTotalPayment.toFixed(2)}
                {t("euro")}
              </span>
            </div>
          </div>
        </div>

        <Elements 
          stripe={stripePromise}
          options={{
            clientSecret: clientSecret || '',
            locale: language === 'es' ? 'es' : language === 'nl' ? 'nl' : 'en',
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#4f46e5',
                colorBackground: '#ffffff',
                colorText: '#30313d',
                fontFamily: 'Inter, system-ui, sans-serif',
              }
            }
          }}
        >
          <StripePaymentForm 
            clientSecret={clientSecret!}
            customerData={customerData}
            calculateTotal={() => orderTotalPayment}
            setCurrentStep={setCurrentStep}
            setPaymentError={setPaymentError}
            sendConfirmationEmail={sendConfirmationEmail}
            setSelectedBikes={setSelectedBikes}
            setClientSecret={setClientSecret}
            language={language}
            selectedBikes={selectedBikes}
            selectedAccessories={selectedAccessories}
            hasInsurance={hasInsurance}
            startDate={startDate}
            endDate={endDate}
            pickupTime={pickupTime}
            returnTime={returnTime}
            t={t}
          />
        </Elements>

        {paymentError && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {paymentError}
          </div>
        )}
      </CardContent>
    </Card>
  );

      case "confirmation":
        return (
          <Card>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${paymentError ? 'text-red-600' : 'text-green-600'}`}>
                <CheckCircle className="h-5 w-5" />
                {paymentError ? t("paymentFailed") : t("reservationConfirmed")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                {paymentError ? (
                  <>
                    <p className="text-lg text-red-600">{paymentError}</p>
                    <p className="text-sm text-gray-600">{t("paymentRetryInstructions")}</p>
                    <Button onClick={() => setCurrentStep("payment")} className="mt-4">
                      {t("tryAgain")}
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
                )}

                <div className="flex flex-col gap-4 mt-6 sm:flex-row">
                  {isAdminMode ? (
                    <>
                      <Button onClick={() => window.location.reload()} className="flex-1">
                        {t("reservationNew")}
                      </Button>
                      <Button variant="outline" onClick={() => window.close()} className="flex-1">
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
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            {t("reserve")}{" "}
            {isAdminMode && <Badge variant="secondary">Modo Admin</Badge>}
          </h1>

          <div className="flex items-center flex-nowrap gap-2 md:gap-4 mb-8 overflow-x-auto sm:overflow-x-visible sm:justify-between pb-2">
            {[
              { key: "dates", label: t("dates"), icon: CalendarDays },
              { key: "bikes", label: t("bikes"), icon: ShoppingCart },
              { key: "accessories", label: t("accessories"), icon: ShoppingCart },
              { key: "customer", label: t("customerData"), icon: CreditCard },
              ...(isAdminMode
                ? []
                : [{ key: "payment", label: t("payment"), icon: CreditCard }]),
              { key: "confirmation", label: t("confirmation"), icon: CheckCircle },
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
                  className="flex flex-col items-center flex-shrink-0 min-w-[60px] md:min-w-[120px]"
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
                    className={`mt-1 text-xs text-center ${
                      isActive
                        ? "text-green-600 font-medium"
                        : isCompleted
                          ? "text-green-600"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
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