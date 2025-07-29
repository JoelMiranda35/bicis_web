'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
import { CheckCircle } from 'lucide-react';
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

function SuccessContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [isValidSignature, setIsValidSignature] = useState<boolean | null>(null);

  // Obtener parámetros
  const paramsB64 = searchParams.get('Ds_MerchantParameters');
  const signature = searchParams.get('Ds_Signature');
  
  // orderId es usualmente dentro de Ds_MerchantParameters. 
  // También se mantiene el fallback orderIdFromParams por si se pasara fuera.
  const orderIdFromParams = searchParams.get('order'); 
  
  useEffect(() => {
    if (paramsB64 && signature) {
      try {
        const decodedParams = JSON.parse(Buffer.from(paramsB64, 'base64').toString());
        // Establecer los detalles decodificados. Ds_Order es el ID de pedido de Redsys.
        setPaymentDetails(decodedParams); 

        // NOTA DE SEGURIDAD IMPORTANTE:
        // Esta clave (process.env.NEXT_PUBLIC_REDSYS_SECRET_KEY) NO DEBE exponerse en el lado del cliente.
        // Para producción, la verificación de la firma DEBE ocurrir en el servidor.
        // El manual de Redsys especifica que la clave secreta es para uso del lado del servidor.
        // Esta verificación del lado del cliente es solo para depuración y corrección inmediata del build.
        const secretKey = process.env.NEXT_PUBLIC_REDSYS_SECRET_KEY;
        
        if (!secretKey) {
            console.warn("REDSYS_SECRET_KEY no encontrada. La firma no puede verificarse en el cliente.");
            setIsValidSignature(false); // No se puede verificar sin la clave
            return;
        }

        const isValid = verifySignature(
          secretKey,
          paramsB64,
          signature
        );
        setIsValidSignature(isValid);

        // Si la firma no es válida, advertir
        if (!isValid) {
            console.warn("La verificación de la firma de Redsys falló en el lado del cliente.");
        }

      } catch (error) {
        console.error("Error al analizar los parámetros de Redsys o verificar la firma:", error);
        setIsValidSignature(false);
        setPaymentDetails(null);
      }
    }
  }, [paramsB64, signature, orderIdFromParams]); // Asegurarse de listar todas las dependencias

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              {t('paymentSuccess')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-lg">{t('paymentSuccessMessage')}</p>
              
              {paymentDetails?.Ds_Order && (
                <p className="text-sm text-gray-600">
                  {t('referenceNumber')}: <strong>{paymentDetails.Ds_Order}</strong>
                </p>
              )}

              {/* Mostrar detalles del pago si están disponibles */}
              {paymentDetails && (
                <div className="bg-blue-50 p-4 rounded-lg mt-4">
                  <h4 className="font-semibold mb-2">{t('paymentDetails')}</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>{t('amount')}:</strong> {(Number(paymentDetails.Ds_Amount) / 100).toFixed(2)}€
                    </p>
                    <p>
                      <strong>{t('date')}:</strong> {paymentDetails.Ds_Date} {paymentDetails.Ds_Hour}
                    </p>
                    <p>
                      <strong>{t('authorization')}:</strong> {paymentDetails.Ds_AuthorisationCode || t('pending')}
                    </p>
                  </div>
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

              <div className="bg-green-50 p-4 rounded-lg mt-6">
                <h4 className="font-semibold mb-2">{t('nextSteps')}</h4>
                <ul className="text-sm text-left space-y-1">
                  <li>{t('comeToStore')}</li>
                  <li>{t('bringDocuments')}</li>
                  <li>{t('reviewBikes')}</li>
                </ul>
              </div>

              <Button asChild className="w-full mt-6">
                <a href="/">{t('backToHome')}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <SuccessContent />
    </Suspense>
  );
}