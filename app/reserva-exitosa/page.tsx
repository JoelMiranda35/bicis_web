export const dynamic = 'force-dynamic'; // ¡Solución clave!

'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuccessPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

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