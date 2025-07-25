import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Configuración para pruebas
const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago';
const MERCHANT_CODE = '367064094'; // Tu código de comercio
const TERMINAL = '001'; // Terminal de pruebas
const SECRET_KEY = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG'; // Clave de pruebas

interface MerchantParams {
  DS_MERCHANT_AMOUNT: string;
  DS_MERCHANT_ORDER: string;
  DS_MERCHANT_MERCHANTCODE: string;
  DS_MERCHANT_CURRENCY: string;
  DS_MERCHANT_TRANSACTIONTYPE: string;
  DS_MERCHANT_TERMINAL: string;
  DS_MERCHANT_MERCHANTURL: string;
  DS_MERCHANT_URLOK: string;
  DS_MERCHANT_URLKO: string;
  DS_MERCHANT_CONSUMERLANGUAGE: string;
  DS_MERCHANT_PRODUCTDESCRIPTION: string;
  DS_MERCHANT_TITULAR: string;
  DS_MERCHANT_MERCHANTDATA: string;
}

export async function POST(request: Request) {
  try {
    const { amount, orderId, locale } = await request.json();

    // Validación básica
    if (!amount || !orderId) throw new Error('Faltan amount u orderId');

    // Configuración de URLs (¡sin route.ts!)
    const notificationUrl = 'https://alteabikeshop.com/api/notification'; // ← Punto clave
    const siteUrl = 'https://alteabikeshop.com';

    // Parámetros para Redsys
    const merchantParams: MerchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(),
      DS_MERCHANT_ORDER: orderId.padStart(12, '0').slice(0, 12),
      DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: TERMINAL,
      DS_MERCHANT_MERCHANTURL: notificationUrl, // URL limpia
      DS_MERCHANT_URLOK: `${siteUrl}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${siteUrl}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: 'Cliente de prueba',
      DS_MERCHANT_MERCHANTDATA: orderId
    };

    // Codificación segura para Redsys
    const paramsJson = JSON.stringify(merchantParams);

    const paramsB64 = Buffer.from(paramsJson).toString('base64').replace(/\n/g, '');

    // Firma HMAC-SHA256
    const key = Buffer.from(SECRET_KEY, 'base64');
    const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0));
    const derivedKey = Buffer.concat([
      cipher.update(merchantParams.DS_MERCHANT_ORDER.slice(0, 8), 'utf8'),
      cipher.final()
    ]);
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return NextResponse.json({
      success: true,
      url: REDSYS_TEST_URL,
      params: paramsB64,
      signature,
      testCard: {
        number: '4548812049400004',
        expiry: '12/2025',
        cvv: '123'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}