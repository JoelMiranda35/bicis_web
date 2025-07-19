'use client';
export const dynamic = 'force-dynamic';


import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function FailureContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');

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
              
              <div className="bg-red-50 p-4 rounded-lg mt-6">
                <h4 className="font-semibold mb-2">{t('whatToDoNow')}</h4>
                <ul className="text-sm text-left space-y-1">
                  <li>{t('tryAnotherCard')}</li>
                  <li>{t('contactSupport')}</li>
                  <li>{t('visitOurStore')}</li>
                </ul>
              </div>

              <div className="flex gap-4 mt-6">
                <Button variant="outline" asChild className="flex-1">
                  <a href="/contact">{t('contactUs')}</a>
                </Button>
                <Button asChild className="flex-1">
                  <a href="/">{t('backToHome')}</a>
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
    <Suspense fallback={<div>Cargando...</div>}>
      <FailureContent />
    </Suspense>
  );
}