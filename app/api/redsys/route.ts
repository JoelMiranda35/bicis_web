import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración para entorno de pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: process.env.REDSYS_MERCHANT_CODE || '999008881',
    terminal: process.env.REDSYS_TERMINAL || '1',
    secretKey: process.env.REDSYS_SECRET_KEY || 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  };

  try {
    const { amount, orderId, locale = 'es' } = await request.json();

    // Validación de parámetros
    if (!amount || isNaN(Number(amount))) {
      throw new Error('Amount is required and must be a number');
    }
    if (!orderId || orderId.toString().length !== 12) {
      throw new Error('OrderId must be exactly 12 digits');
    }

    // 1. Preparar parámetros de la transacción
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(), // Convertir a céntimos
      DS_MERCHANT_ORDER: orderId.toString().padStart(12, '0').slice(0, 12),
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Autorización
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/redsys-notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001' // 002=español, 001=inglés
    };

    // 2. Convertir parámetros a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Calcular la firma HMAC-SHA256 con la nueva clave
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificar longitud de la clave (debe ser 24 bytes después de decodificar)
    if (secretKeyBytes.length !== 24) {
      throw new Error(`Invalid secret key length: ${secretKeyBytes.length} bytes (expected 24)`);
    }

    // Cifrado 3DES del orderId (primeros 8 dígitos)
    const iv = Buffer.alloc(8, 0); // Vector de inicialización (ceros)
    const orderPrefix = merchantParams.DS_MERCHANT_ORDER.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    // Configurar cifrado 3DES
    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false); // Importante: desactivar padding automático
    
    // Cifrar el orderId
    const encryptedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Devolver respuesta
    return NextResponse.json({
      success: true,
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debug: process.env.NODE_ENV === 'development' ? {
        merchantParams,
        paramsB64,
        orderPrefix,
        encryptedKey: encryptedKey.toString('hex'),
        receivedData: { // Mover los datos recibidos aquí dentro
          amount,
          orderId,
          locale
        }
      } : undefined
    });

  } catch (error) {
    console.error('Error en Redsys:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error processing payment',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: process.env.NODE_ENV === 'development' ? {
          advice: [
            'Verify secret key is correctly set in .env',
            'OrderId must be exactly 12 digits',
            'Amount must be a positive number',
            'Check terminal and merchant code'
          ]
        } : undefined
      },
      { status: 400 }
    );
  }
}