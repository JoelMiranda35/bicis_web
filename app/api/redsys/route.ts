import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Configuración
const ENV = {
  REDSYS_URL: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  MERCHANT_CODE: process.env.REDSYS_MERCHANT_CODE,
  TERMINAL: process.env.REDSYS_TERMINAL || '001',
  SECRET_KEY: process.env.REDSYS_SECRET_KEY,
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
};

export async function POST(request: Request) {
  try {
    // Validación de configuración
    if (!ENV.MERCHANT_CODE || !ENV.SECRET_KEY || !ENV.SITE_URL) {
      throw new Error('Configuración incompleta');
    }

    // Parse y validación de input
    const { amount, orderId, locale = 'es' } = await request.json();

    if (amount == null) throw new Error('"amount" es requerido');
    if (!orderId || !/^\d{12}$/.test(orderId)) {
      throw new Error('"orderId" debe ser un string de 12 dígitos');
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      throw new Error('"amount" debe ser un número positivo');
    }

    // Construcción de parámetros Redsys
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

    // Generación de firma (paso a paso)
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 1. Decodificar la clave secreta de Base64
    const secretKeyBytes = Buffer.from(ENV.SECRET_KEY, 'base64');
    if (secretKeyBytes.length !== 24) {
      throw new Error('Clave secreta inválida. Debe ser Base64 y 24 bytes decodificados');
    }

    // 2. Cifrar los primeros 8 dígitos del orderId con 3DES
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderId.slice(0, 8)).copy(orderPadded);

    // Usar createCipheriv con ECB (no IV) y ZeroPadding
    const cipher = crypto.createCipheriv('des-ede3', secretKeyBytes, Buffer.alloc(0));
    cipher.setAutoPadding(false); // Desactivar padding automático
    
    let derivedKey = cipher.update(orderPadded);
    derivedKey = Buffer.concat([derivedKey, cipher.final()]);

    // 3. Calcular HMAC-SHA256 con la clave derivada
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      url: ENV.REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      ...(process.env.NODE_ENV === 'development' && {
        _debug: {
          orderId,
          amountInCents,
          terminal: ENV.TERMINAL,
          derivedKey: derivedKey.toString('hex') // Para depuración
        }
      })
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    console.error('Error Redsys:', errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && {
          _debug: {
            advice: 'Verifique: 1) Clave secreta 2) orderId (12 dígitos) 3) amount (número positivo)',
            env: {
              hasMerchantCode: !!ENV.MERCHANT_CODE,
              hasSecretKey: !!ENV.SECRET_KEY,
              hasSiteUrl: !!ENV.SITE_URL,
              terminal: ENV.TERMINAL
            }
          }
        })
      },
      { status: 500 }
    );
  }
}