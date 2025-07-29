'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { verifySignature } from '@/lib/redsysUtils';

function FailureContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isValidSignature, setIsValidSignature] = useState<boolean | null>(null);

  // Obtener parámetros
  const paramsB64 = searchParams.get('Ds_MerchantParameters');
  const signature = searchParams.get('Ds_Signature');
  const errorMessage = searchParams.get('error');
  const orderIdFromParams = searchParams.get('order');
  
  // Determinar orderId (prioridad a Redsys)
  const orderId = paramsB64 
    ? JSON.parse(Buffer.from(paramsB64, 'base64').toString()).Ds_Merchant_Order 
    : orderIdFromParams;

  useEffect(() => {
    if (paramsB64 && signature) {
      // Validar firma
      const isValid = verifySignature(
        process.env.NEXT_PUBLIC_REDSYS_SECRET_KEY!,
        orderId,
        paramsB64,
        signature
      );
      setIsValidSignature(isValid);

      // Obtener mensaje de error de Redsys si existe
      if (isValid) {
        const details = JSON.parse(Buffer.from(paramsB64, 'base64').toString());
        if (details.Ds_Response) {
          setPaymentError(getRedsysError(details.Ds_Response));
        }
      }
    } else if (errorMessage) {
      setPaymentError(errorMessage);
    }
  }, [paramsB64, signature, errorMessage, orderId]);

  // Función para traducir códigos de error de Redsys
  const getRedsysError = (code: string) => {
    const errors: Record<string, string> = {
      '0101': t('errorCardExpired'),
      '0184': t('errorAuthenticationFailed'),
      '0190': t('errorContactBank'),
      default: t('paymentGenericError')
    };
    return errors[code] || errors.default;
  };

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