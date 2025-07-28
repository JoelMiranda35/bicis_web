import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración con tu clave específica
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: process.env.NEXT_PUBLIC_REDSYS_MERCHANT_CODE || '367064094', // Usa tu código real
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG', // CLAVE ESPECÍFICA
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId, locale = 'es' } = await request.json();

    // Validación estricta
    const amountInCents = Math.round(Number(amount));
    const orderIdStr = orderId.toString().padStart(12, '0').slice(0, 12);

    if (isNaN(amountInCents)) {
      throw new Error('Amount must be a valid number');
    }

    if (amountInCents <= 0) {
      throw new Error('Amount must be positive');
    }

    if (orderIdStr.length !== 12) {
      throw new Error('OrderId must be exactly 12 digits');
    }

    // 1. Parámetros de la transacción (EXACTAMENTE como los espera Redsys)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978', // 978 = Euros
      DS_MERCHANT_TRANSACTIONTYPE: '0', // 0 = Autorización
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : locale === 'en' ? '002' : '004' // 002=ES, 004=NL
    };

    // 2. Convertir parámetros a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de la firma (Método EXACTO de Redsys)
    // a) Decodificar la clave secreta de Base64
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificación crítica de la clave
    if (secretKeyBytes.length !== 24) {
      console.error('❌ Clave incorrecta. Longitud:', secretKeyBytes.length);
      throw new Error('Invalid secret key length. Must decode to 24 bytes (32 chars Base64)');
    }

    // b) Cifrado 3DES del número de pedido (primeros 8 dígitos)
    const iv = Buffer.alloc(8, 0); // Vector de inicialización lleno de ceros
    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false); // Importante: ZeroPadding
    
    const orderPrefix = orderIdStr.slice(0, 8); // Primeros 8 dígitos
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);
    
    const encryptedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // c) Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Respuesta con datos para depuración
    return NextResponse.json({
      url: config.redsysUrl,
      dsMerchantParameters: paramsB64,
      dsSignature: signature,
      dsSignatureVersion: 'HMAC_SHA256_V1',
      debugInfo: {
        originalAmount: amount,
        amountInCents: amountInCents,
        orderId: orderIdStr,
        paramsJson: merchantParams,
        secretKey: config.secretKey,
        encryptedKeyHex: encryptedKey.toString('hex'),
        paramsBase64: paramsB64
      }
    });

  } catch (error) {
    console.error('❌ Error en el procesamiento del pago:', error);
    return NextResponse.json(
      {
        error: 'Error en el procesamiento del pago con Redsys',
        details: error instanceof Error ? error.message : String(error),
        criticalCheck: [
          '1. Clave usada: JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
          '2. OrderId exactamente 12 dígitos',
          '3. Importe en céntimos (ej: 40.00€ = 4000)',
          '4. URLs accesibles desde internet',
          '5. Código comercio exacto (' + (process.env.NEXT_PUBLIC_REDSYS_MERCHANT_CODE || '367064094') + ')',
          '6. Terminal configurado correctamente (1)'
        ],
        solution: 'Contacta con soporte técnico de Redsys y proporciona los detalles del error'
      },
      { status: 400 }
    );
  }
}