import { NextResponse } from 'next/server';
import crypto from 'crypto';

// 1. Configuración centralizada de variables de entorno
const ENV = {
  REDSYS_URL: 'https://sis-t.redsys.es:25443/sis/realizarPago', // Hardcodeado porque es fijo
  MERCHANT_CODE: process.env.REDSYS_MERCHANT_CODE, // Solo variable privada
  TERMINAL: process.env.REDSYS_TERMINAL || '001', // Default '001'
  SECRET_KEY: process.env.REDSYS_SECRET_KEY,
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL // Única variable pública necesaria
};

// 2. Validación temprana de configuración (solo en startup)
if (!ENV.MERCHANT_CODE || !ENV.SECRET_KEY) {
  const missing = [];
  if (!ENV.MERCHANT_CODE) missing.push('REDSYS_MERCHANT_CODE');
  if (!ENV.SECRET_KEY) missing.push('REDSYS_SECRET_KEY');
  
  console.error('❌ Configuración crítica faltante:', missing.join(', '));
  // No throw aquí para permitir que el servidor inicie, pero fallará en las requests
}

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
  DS_MERCHANT_PRODUCTDESCRIPTION?: string;
  DS_MERCHANT_TITULAR?: string;
}

export async function POST(request: Request) {
  try {
    // 3. Validación de configuración por request
    if (!ENV.MERCHANT_CODE || !ENV.SECRET_KEY || !ENV.SITE_URL) {
      throw new Error(
        `Configuración incompleta. Verifique: ${
          !ENV.MERCHANT_CODE ? 'REDSYS_MERCHANT_CODE ' : ''
        }${
          !ENV.SECRET_KEY ? 'REDSYS_SECRET_KEY ' : ''
        }${
          !ENV.SITE_URL ? 'NEXT_PUBLIC_SITE_URL' : ''
        }`
      );
    }

    // 4. Parse y validación de input
    const { amount, orderId, locale = 'es' } = await request.json();

    if (amount == null) throw new Error('"amount" es requerido');
    if (!orderId || !/^\d{12}$/.test(orderId)) {
      throw new Error('"orderId" debe ser un string de 12 dígitos');
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      throw new Error('"amount" debe ser un número positivo');
    }

    // 5. Construcción de parámetros Redsys
    const amountInCents = Math.round(amountNumber * 100).toString();
    const baseUrl = ENV.SITE_URL;
    
    const merchantParams: MerchantParams = {
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

    // 6. Generación de firma (paso a paso con validaciones)
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // Validación clave secreta
    let secretKeyBytes;
    try {
      secretKeyBytes = Buffer.from(ENV.SECRET_KEY, 'base64');
      if (secretKeyBytes.length !== 24) {
        throw new Error('Longitud inválida');
      }
    } catch (e) {
      throw new Error('Clave secreta inválida. Debe ser Base64 y 24 bytes decodificados');
    }

    // Derivación de clave
    const cipher = crypto.createCipheriv('des-ede3', secretKeyBytes, Buffer.alloc(0));
    cipher.setAutoPadding(false);
    
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderId.slice(0, 8)).copy(orderPadded);
    
    const derivedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    // Firma HMAC
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 7. Respuesta exitosa (sin debug info en producción)
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
          terminal: ENV.TERMINAL
        }
      })
    });

  } catch (error) {
    // 8. Manejo centralizado de errores
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const isDev = process.env.NODE_ENV === 'development';
    
    console.error('🚨 Error Redsys:', {
      error: errorMessage,
      ...(isDev && { stack: error instanceof Error ? error.stack : undefined }),
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(isDev && {
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