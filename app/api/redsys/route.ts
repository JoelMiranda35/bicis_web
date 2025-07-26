import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Configuración específica para tu comercio
const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago';
const MERCHANT_CODE = '367064094'; // Tu código de comercio
const TERMINAL = '001'; // Tu terminal
const SECRET_KEY = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG'; // Tu clave específica (en Base64)

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
  DS_MERCHANT_CONSUMERLANGUAGE?: string;
}

export async function POST(request: Request) {
  try {
    const { amount, orderId, locale } = await request.json();

    // Validaciones
    if (!amount || !orderId) {
      throw new Error('Missing required parameters: amount or orderId');
    }

    // Convertir amount a céntimos (sin decimales)
    const amountInCents = Math.round(Number(amount) * 100).toString();
    if (Number(amountInCents) <= 0) {
      throw new Error('Invalid amount - must be greater than 0');
    }

    // Formatear orderId (12 dígitos)
    const orderCode = orderId.toString().padStart(12, '0').slice(-12);

    // Parámetros para Redsys (formato exacto)
    const merchantParams: MerchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderCode,
      DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago estándar
      DS_MERCHANT_TERMINAL: TERMINAL,
      DS_MERCHANT_MERCHANTURL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/redsys/notification`,
      DS_MERCHANT_URLOK: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001' // 002=Español
    };

    // 1. Convertir parámetros a JSON y luego a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 2. Derivar clave (3DES)
    const secretKeyBytes = Buffer.from(SECRET_KEY, 'base64'); // Clave en Base64
    const cipher = crypto.createCipheriv('des-ede3', secretKeyBytes, Buffer.alloc(0));
    
    // Rellenar orderCode a 8 bytes
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderCode.slice(0, 8)).copy(orderPadded);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // 3. Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    return NextResponse.json({
      success: true,
      url: REDSYS_TEST_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debug: process.env.NODE_ENV === 'development' ? {
        paramsJson,
        orderCode,
        amountInCents
      } : undefined
    });

  } catch (error) {
    console.error('Error in Redsys integration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : null
        } : undefined
      },
      { status: 500 }
    );
  }
}