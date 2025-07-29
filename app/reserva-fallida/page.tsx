'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// No se importa desde '@/lib/redsysUtils' porque no existe esa carpeta/archivo.

// IMPORTANTE: Para el uso del lado del cliente, necesitas importar crypto-js.
// Sin embargo, EXPONER TU CLAVE SECRETA DE REDSYS (process.env.NEXT_PUBLIC_REDSYS_SECRET_KEY)
// EN EL FRONTEND ES UNA VULNERABILIDAD DE SEGURIDAD MAYOR.
// La forma recomendada y segura de verificar la firma es enviar
// Ds_MerchantParameters y Ds_Signature a un endpoint de API del lado del SERVIDOR
// que luego realiza la verificación utilizando la CLAVE SECRETA.
// Esta implementación es solo para fines de demostración para corregir el error de compilación,
// pero NO debe usarse en un entorno de producción con una clave verdaderamente secreta.
import CryptoJS from 'crypto-js';

// Función auxiliar para el cifrado TripleDES en el lado del cliente (para la derivación de la clave HMAC)
const tripleDesEncrypt = (message: string, key: string) => {
    // Redsys utiliza un IV de 8 bytes de ceros
    const iv = CryptoJS.enc.Utf8.parse("\x00\x00\x00\x00\x00\x00\x00\x00"); // 8 bytes nulos

    // La clave secreta de Redsys está codificada en Base64 y se usa para DES-EDE3 (TripleDES)
    const keyParsed = CryptoJS.enc.Base64.parse(key);

    const encrypted = CryptoJS.TripleDES.encrypt(
        CryptoJS.enc.Utf8.parse(message),
        keyParsed,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.ZeroPadding,
        }
    );
    // El resultado de CryptoJS.encrypt ya es una cadena Base64 del texto cifrado
    return encrypted.toString();
};

// Función auxiliar para verificar la firma de Redsys en el lado del cliente
const verifySignature = (
    secretKey: string,
    paramsB64: string, // Esto es Ds_MerchantParameters (JSON codificado en Base64)
    receivedSignature: string
): boolean => {
    try {
        // Paso 1: Cifrar Ds_MerchantParameters usando TripleDES con la secretKey
        // El resultado de este cifrado se decodifica de Base64 para convertirse en la clave HMAC.
        const encryptedParamsAsHmacKeyBase64 = tripleDesEncrypt(paramsB64, secretKey);

        // Paso 2: Decodificar de Base64 los parámetros cifrados para obtener los bytes reales de la clave HMAC
        const hmacKeyBytes = CryptoJS.enc.Base64.parse(encryptedParamsAsHmacKeyBase64);

        // Paso 3: Calcular HMAC-SHA256. Los datos para HMAC son los Ds_MerchantParameters originales (cadena Base64)
        const hmacDataBytes = CryptoJS.enc.Utf8.parse(paramsB64);

        const calculatedHmac = CryptoJS.HmacSHA256(hmacDataBytes, hmacKeyBytes);
        const calculatedSignature = CryptoJS.enc.Base64.stringify(calculatedHmac);

        // Paso 4: Comparar la firma calculada con la firma recibida de Redsys
        return calculatedSignature === receivedSignature;
    } catch (e) {
        console.error("Error al verificar la firma de Redsys en el cliente:", e);
        return false;
    }
};


function FailureContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isValidSignature, setIsValidSignature] = useState<boolean | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null); // Para almacenar los parámetros decodificados

  // Obtener parámetros
  const paramsB64 = searchParams.get('Ds_MerchantParameters');
  const signature = searchParams.get('Ds_Signature');
  const errorMessageFromQuery = searchParams.get('error'); // Error genérico desde tus propias redirecciones

  let orderId: string | null = null; // Declarar orderId en un ámbito accesible para el renderizado

  // Función para traducir códigos de error de Redsys
  const getRedsysError = (code: string) => {
    const errors: Record<string, string> = {
      '0101': t('errorCardExpired'),
      '0184': t('errorAuthenticationFailed'),
      '0190': t('errorContactBank'),
      '900': t('transactionDenied'), // Ejemplo para denegación genérica
      '909': t('invalidFormat'), // Ejemplo
      '912': t('issuerNotAvailable'), // Ejemplo
      default: t('paymentGenericError')
    };
    // Redsys usa códigos como "0101", "0000", "0900", etc.
    // Asegurarse de que el código sea una cadena.
    return errors[code] || errors.default;
  };

  useEffect(() => {
    if (paramsB64 && signature) {
      try {
        const decodedParams = JSON.parse(Buffer.from(paramsB64, 'base64').toString());
        setPaymentDetails(decodedParams); // Almacenar los parámetros decodificados

        // NOTA DE SEGURIDAD IMPORTANTE:
        // Esta clave (process.env.NEXT_PUBLIC_REDSYS_SECRET_KEY) NO DEBE exponerse en el lado del cliente.
        // Para producción, la verificación de la firma DEBE ocurrir en el servidor.
        // El manual de Redsys especifica que la clave secreta es para uso del lado del servidor.
        // Esta verificación del lado del cliente es solo para depuración y corrección inmediata del build.
        const secretKey = process.env.NEXT_PUBLIC_REDSYS_SECRET_KEY;
        
        if (!secretKey) {
            console.warn("REDSYS_SECRET_KEY no encontrada. La firma no puede verificarse en el cliente.");
            setIsValidSignature(false); // No se puede verificar sin la clave
            setPaymentError(t('paymentVerificationUnavailable'));
            return;
        }

        const isValid = verifySignature(
          secretKey,
          paramsB64,
          signature
        );
        setIsValidSignature(isValid);

        // Si la firma es válida, intentar obtener el error específico de Redsys
        if (isValid && decodedParams.Ds_Response) {
          setPaymentError(getRedsysError(String(decodedParams.Ds_Response)));
        } else if (!isValid) {
            console.warn("La verificación de la firma de Redsys falló en el lado del cliente.");
            setPaymentError(t('signatureVerificationFailed'));
        }

      } catch (error) {
        console.error("Error al analizar los parámetros de Redsys o verificar la firma:", error);
        setIsValidSignature(false);
        setPaymentError(t('paymentProcessingError'));
      }
    } else if (errorMessageFromQuery) {
      // Si no hay parámetros de Redsys, pero se pasa un mensaje de error genérico
      setPaymentError(errorMessageFromQuery);
      setIsValidSignature(null); // No hay firma de Redsys para verificar
    } else {
        setPaymentError(t('noPaymentInfoAvailable'));
        setIsValidSignature(null);
    }
  }, [paramsB64, signature, errorMessageFromQuery, t]);

  // Determinar orderId a partir de los detalles disponibles para mostrarlo
  orderId = paymentDetails?.Ds_Order || searchParams.get('order');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t('paymentFailed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-lg">{t('paymentFailedMessage')}</p>
              
              {orderId && (
                <p className="text-sm text-gray-600">
                  {t('referenceNumber')}: <strong>{orderId}</strong>
                </p>
              )}

              {/* Mostrar error específico si está disponible */}
              {paymentError && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-red-600"><strong>{t('error')}:</strong> {paymentError}</p>
                </div>
              )}

              {/* Advertencia si la firma no es válida */}
              {isValidSignature === false && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-yellow-700 text-sm">
                    {t('signatureWarning')}
                    <br/>
                    {t('signatureWarningDetails')}
                  </p>
                </div>
              )}

              <div className="bg-red-50 p-4 rounded-lg mt-6">
                <h4 className="font-semibold mb-2">{t('whatToDoNow')}</h4>
                <ul className="text-sm text-left space-y-1">
                  <li>{t('tryAnotherCard')}</li>
                  <li>{t('contactSupport')}</li>
                  <li>{t('visitOurStore')}</li>
                </ul>
              </div>

              <div className="flex gap-4 mt-6">
                <Button asChild variant="outline" className="flex-1">
                  <a href="/contact">{t('contactUs')}</a>
                </Button>
                <Button asChild className="flex-1">
                  <a href="/reserve">{t('tryAgain')}</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function FailurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <FailureContent />
    </Suspense>
  );
}