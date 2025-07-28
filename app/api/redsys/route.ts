import { NextResponse } from 'next/server';
import crypto from 'crypto';

const ENV = {
  REDSYS_URL: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  MERCHANT_CODE: process.env.REDSYS_MERCHANT_CODE,
  TERMINAL: process.env.REDSYS_TERMINAL || '001',
  SECRET_KEY: process.env.REDSYS_SECRET_KEY,      // Clave Base64 de test (la que empieza por “JvJ4…”)
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
};

export async function POST(request: Request) {
  try {
    if (!ENV.MERCHANT_CODE || !ENV.SECRET_KEY || !ENV.SITE_URL) {
      throw new Error('Configuración incompleta');
    }

    const { amount, orderId, locale = 'es' } = await request.json();

    if (amount == null) throw new Error('"amount" es requerido');
    if (!orderId || !/^\d{12}$/.test(orderId)) {
      throw new Error('"orderId" debe ser un string de 12 dígitos');
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      throw new Error('"amount" debe ser un número positivo');
    }

    // Construcción de merchantParams
    const amountInCents = Math.round(amountNumber * 100).toString();
    const baseUrl = ENV.SITE_URL;
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: ENV.MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: ENV.TERMINAL,
      DS_MERCHANT_MERCHANTURL: `${baseUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${baseUrl}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${baseUrl}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: 'Altea Bike Shop'
    };

    // 1. Base64 de merchantParams
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson, 'utf8').toString('base64');

    // 2. Decodificar clave secreta (Base64 → 24 bytes)
    const secretKeyBytes = Buffer.from(ENV.SECRET_KEY, 'base64');
    if (secretKeyBytes.length !== 24) {
      throw new Error('Clave secreta inválida: debe decodificarse a 24 bytes');
    }

    // 3. Preparar IV de 8 bytes a cero
    const iv = Buffer.alloc(8, 0);

    // 4. Preparar orderPadded (8 bytes, ceros + orderId prefix)
    const orderPrefix = orderId.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix, 'utf8').copy(orderPadded);

    // 5. Cifrar con 3DES CBC + ZeroPadding manual
    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false);
    const firstChunk = cipher.update(orderPadded);
    const finalChunk = cipher.final();
    const derivedKey = Buffer.concat([firstChunk, finalChunk]);

    // 6. Calcular HMAC-SHA256 sobre paramsB64
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64, 'utf8');
    const signature = hmac.digest('base64');

    return NextResponse.json({
      success: true,
      url: ENV.REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      ...(process.env.NODE_ENV === 'development' && {
        _debug: {
          merchantParams,
          paramsJson,
          paramsB64,
          secretKeyBytes: secretKeyBytes.toString('hex'),
          iv: iv.toString('hex'),
          orderPadded: orderPadded.toString('hex'),
          derivedKey: derivedKey.toString('hex')
        }
      })
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Error Redsys:', message);
    return NextResponse.json(
      {
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && {
          _debug: {
            advice: [
              'Usar clave de test (JvJ4…) en REDSYS_SECRET_KEY',
              'Clave Base64 decodifica a 24 bytes',
              'CBC + IV cero + ZeroPadding',
              'orderId de 12 dígitos'
            ],
            env: {
              merchantCode: !!ENV.MERCHANT_CODE,
              secretKey: !!ENV.SECRET_KEY,
              siteUrl: !!ENV.SITE_URL,
              terminal: ENV.TERMINAL
            }
          }
        })
      },
      { status: 500 }
    );
  }
}
