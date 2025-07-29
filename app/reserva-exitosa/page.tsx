'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { verifySignature } from '@/lib/redsysUtils';

function SuccessContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [isValidSignature, setIsValidSignature] = useState<boolean | null>(null);

  // Obtener parámetros
  const paramsB64 = searchParams.get('Ds_MerchantParameters');
  const signature = searchParams.get('Ds_Signature');
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

      // Parsear detalles del pago
      if (isValid) {
        setPaymentDetails(JSON.parse(Buffer.from(paramsB64, 'base64').toString()));
      }
    }
  }, [paramsB64, signature, orderId]);

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
              
              {orderId && (
                <p className="text-sm text-gray-600">
                  {t('referenceNumber')}: <strong>{orderId}</strong>
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