import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Configuración para pruebas
const TEST_CONFIG = {
  REDSYS_URL: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  MERCHANT_CODE: '999008881', // Código de comercio de TEST
  TERMINAL: '1',
  SECRET_KEY: 'JvJ4Vq9y8bP5zX2wN7x9S2aVbQ3cD4eF', // Clave de TEST
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://www.alteabikeshop.com',
};

export async function POST(request: Request) {
  try {
    const { amount, orderId, locale = 'es' } = await request.json();

    // Validación simplificada para pruebas
    if (!amount || !orderId) {
      throw new Error('Faltan amount u orderId');
    }

    // 1. Preparar parámetros de la transacción
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(),
      DS_MERCHANT_ORDER: orderId.padStart(12, '0').slice(0, 12),
      DS_MERCHANT_MERCHANTCODE: TEST_CONFIG.MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: TEST_CONFIG.TERMINAL,
      DS_MERCHANT_MERCHANTURL: `${TEST_CONFIG.SITE_URL}/api/notification`,
      DS_MERCHANT_URLOK: `${TEST_CONFIG.SITE_URL}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${TEST_CONFIG.SITE_URL}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001'
    };

    // 2. Convertir a Base64
    const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64');

    // 3. Calcular firma (HMAC-SHA256)
    const secretKey = Buffer.from(TEST_CONFIG.SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0);
    const orderPrefix = merchantParams.DS_MERCHANT_ORDER.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKey, iv);
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    const hmac = crypto.createHmac('sha256', encrypted);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Respuesta con datos para redirección
    return NextResponse.json({
      url: TEST_CONFIG.REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debugInfo: { // Solo para desarrollo
        merchantParams,
        orderId: merchantParams.DS_MERCHANT_ORDER,
        amount: merchantParams.DS_MERCHANT_AMOUNT
      }
    });

  } catch (error) {
    console.error('Error en Redsys:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido',
      debug: {
        advice: [
          'Verifica que orderId tenga exactamente 12 dígitos',
          'El amount debe ser un número (ej: 50 para 50€)',
          'Usa la clave de prueba que comienza con JvJ4',
          'No incluyas datos de tarjeta - eso lo maneja Redsys'
        ]
      }
    }, { status: 400 });
  }
}