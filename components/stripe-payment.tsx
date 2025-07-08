"use client"

import type React from "react"

import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentFormProps {
  amount: number
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  customerEmail: string
}

function PaymentForm({ amount, onSuccess, onError, customerEmail }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const { t, language } = useLanguage()

  const getErrorMessage = (error: any): string => {
    const errorCode = error.code || error.type

    switch (errorCode) {
      case "card_declined":
        return language === "es"
          ? "Tarjeta rechazada. Contacte con su banco."
          : language === "en"
            ? "Card declined. Please contact your bank."
            : "Kaart geweigerd. Neem contact op met uw bank."

      case "insufficient_funds":
        return language === "es"
          ? "Fondos insuficientes en la tarjeta."
          : language === "en"
            ? "Insufficient funds on the card."
            : "Onvoldoende saldo op de kaart."

      case "incorrect_cvc":
        return language === "es"
          ? "Código CVC incorrecto."
          : language === "en"
            ? "Incorrect CVC code."
            : "Onjuiste CVC-code."

      case "expired_card":
        return language === "es"
          ? "La tarjeta ha expirado."
          : language === "en"
            ? "The card has expired."
            : "De kaart is verlopen."

      case "invalid_expiry_month":
      case "invalid_expiry_year":
        return language === "es"
          ? "Fecha de expiración inválida."
          : language === "en"
            ? "Invalid expiration date."
            : "Ongeldige vervaldatum."

      case "processing_error":
        return language === "es"
          ? "Error procesando el pago. Inténtelo de nuevo."
          : language === "en"
            ? "Error processing payment. Please try again."
            : "Fout bij het verwerken van de betaling. Probeer opnieuw."

      case "authentication_required":
        return language === "es"
          ? "Autenticación 3D Secure requerida."
          : language === "en"
            ? "3D Secure authentication required."
            : "3D Secure authenticatie vereist."

      default:
        return (
          error.message ||
          (language === "es"
            ? "Error en el pago. Inténtelo de nuevo."
            : language === "en"
              ? "Payment error. Please try again."
              : "Betalingsfout. Probeer opnieuw.")
        )
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPaymentError(null)

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    try {
      // Create payment intent
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          metadata: {
            customer_email: customerEmail,
          },
        }),
      })

      // Log response details for debugging
      console.log("Payment intent response status:", response.status)

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `HTTP error! status: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, get text
          try {
            const errorText = await response.text()
            console.error("Non-JSON error response:", errorText)
          } catch (textError) {
            console.error("Could not read error response")
          }
        }
        throw new Error(errorMessage)
      }

      const responseData = await response.json()

      if (responseData.error) {
        throw new Error(responseData.error)
      }

      const { clientSecret, paymentIntentId } = responseData

      if (!clientSecret) {
        throw new Error("Failed to create payment intent")
      }

      // Confirm payment with 3D Secure support
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error("Card element not found")
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: customerEmail,
          },
        },
        return_url: `${window.location.origin}/reserve?payment_return=true`,
      })

      if (error) {
        const errorMessage = getErrorMessage(error)
        setPaymentError(errorMessage)
        onError(errorMessage)
      } else if (paymentIntent.status === "succeeded") {
        onSuccess(paymentIntentId)
      } else if (paymentIntent.status === "requires_action") {
        // 3D Secure authentication in progress
        setPaymentError(
          language === "es"
            ? "Completando autenticación 3D Secure..."
            : language === "en"
              ? "Completing 3D Secure authentication..."
              : "3D Secure authenticatie voltooien...",
        )
      }
    } catch (error) {
      console.error("Payment error:", error)
      let errorMessage = getErrorMessage(error)

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes("HTTP error")) {
          errorMessage =
            language === "es"
              ? "Error de conexión. Verifique su configuración de Stripe."
              : language === "en"
                ? "Connection error. Please check your Stripe configuration."
                : "Verbindingsfout. Controleer uw Stripe-configuratie."
        } else if (error.message.includes("Payment system not configured")) {
          errorMessage =
            language === "es"
              ? "Sistema de pago no configurado. Contacte al administrador."
              : language === "en"
                ? "Payment system not configured. Contact administrator."
                : "Betalingssysteem niet geconfigureerd. Neem contact op met de beheerder."
        } else if (error.message.includes("Failed to create payment intent")) {
          errorMessage =
            language === "es"
              ? "Error al procesar el pago. Verifique su conexión."
              : language === "en"
                ? "Error processing payment. Check your connection."
                : "Fout bij het verwerken van de betaling. Controleer uw verbinding."
        }
      }

      setPaymentError(errorMessage)
      onError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {paymentError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{paymentError}</AlertDescription>
        </Alert>
      )}

      <div className="p-4 border rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
            },
            hidePostalCode: true,
          }}
        />
      </div>

      <Button type="submit" disabled={!stripe || isProcessing} className="w-full">
        {isProcessing ? t("processing") : `${t("pay")} ${amount}€`}
      </Button>
    </form>
  )
}

interface StripePaymentProps {
  amount: number
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  customerEmail: string
}

export function StripePayment({ amount, onSuccess, onError, customerEmail }: StripePaymentProps) {
  const { t } = useLanguage()

  return (
    <Elements stripe={stripePromise}>
      <Card>
        <CardHeader>
          <CardTitle>{t("secureCardPayment")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentForm amount={amount} onSuccess={onSuccess} onError={onError} customerEmail={customerEmail} />
        </CardContent>
      </Card>
    </Elements>
  )
}
