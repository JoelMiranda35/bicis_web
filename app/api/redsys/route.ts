import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración EXACTA para pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881',
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG', // Clave EXACTA
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId } = await request.json();

    // Validación estricta
    const amountInCents = Math.round(Number(amount) * 100);
    const orderIdStr = orderId.toString().padStart(12, '0');

    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('Amount must be positive');
    }

    if (orderIdStr.length !== 12) {
      throw new Error('OrderId must be 12 digits');
    }

    // 1. Parámetros de la transacción
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '002'
    };

    // 2. Convertir a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de firma CORREGIDO
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificación crítica de la clave
    if (secretKeyBytes.length !== 24) {
      console.error('❌ Clave incorrecta. Longitud:', secretKeyBytes.length);
      throw new Error('Invalid secret key length');
    }

    // Cifrado 3DES con ZeroPadding (EXACTO como en su ejemplo)
    const iv = Buffer.alloc(8, 0); // Vector de ceros
    const orderPrefix = orderIdStr.slice(0, 8); // Primeros 8 dígitos
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false); // Importante: ZeroPadding
    const encryptedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    // HMAC-SHA256
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Mostrar datos para depuración
    console.log('\n=== 🔍 DATOS ENVIADOS ===');
    console.log('Params (JSON):', merchantParams);
    console.log('Params (Base64):', paramsB64);
    console.log('Firma calculada:', signature);
    console.log('Clave cifrada (hex):', encryptedKey.toString('hex'));

    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      {
        error: 'Payment processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        solution: [
          '1. Verifica que la clave sea EXACTAMENTE: JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
          '2. Asegúrate que orderId tenga 12 dígitos exactos',
          '3. Confirma que las URLs sean accesibles',
          '4. Revisa los logs del servidor para más detalles'
        ]
      },
      { status: 400 }
    );
  }
}