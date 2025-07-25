import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Configuración - Deberían ser variables de entorno
const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago';
const MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE || '367064094';
const TERMINAL = process.env.REDSYS_TERMINAL || '001';
const SECRET_KEY = process.env.REDSYS_SECRET_KEY || 'sq7HjrUOBfKmC576ILgskD5srU870gJ7';

export async function POST(request: Request) {
  try {
    const { amount, orderId, locale } = await request.json();

    // Validaciones robustas
    if (!amount || !orderId) {
      throw new Error('Missing required parameters: amount or orderId');
    }

    // Validación y conversión del amount
    const amountInCents = Math.round(Number(amount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    // Formatear orderId (12 dígitos)
    const orderCode = orderId.toString().replace(/\D/g, '').padStart(12, '0').slice(-12);
    if (orderCode.length !== 12) {
      throw new Error('Order ID must be convertible to 12 digits');
    }

    // Parámetros obligatorios
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderCode,
      DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago estándar
      DS_MERCHANT_TERMINAL: TERMINAL,
      DS_MERCHANT_MERCHANTURL: `${process.env.SITE_URL}/api/redsys/notification`,
      DS_MERCHANT_URLOK: `${process.env.SITE_URL}/reservation/success?order=${orderId}`,
      DS_MERCHANT_URLKO: `${process.env.SITE_URL}/reservation/failed?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001',
    };

    // Convertir a JSON y luego a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 1. Derivación de clave 3DES
    const key = Buffer.from(SECRET_KEY, 'utf8');
    const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0));
    cipher.setAutoPadding(false);
    
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderCode.slice(0, 8)).copy(orderPadded);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // 2. Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    return NextResponse.json({
      success: true,
      url: REDSYS_TEST_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      testCard: {
        number: '4548812049400004',
        expiry: '12/2025',
        cvv: '123'
      }
    });

  } catch (error) {
    console.error('Redsys API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : null,
          stack: error instanceof Error ? error.stack : null
        } : undefined
      },
      { status: 500 }
    );
  }
}