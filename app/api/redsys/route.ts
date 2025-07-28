import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración EXACTA para pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881', // Código de comercio de pruebas
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG', // Clave EXACTA de pruebas
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId } = await request.json();

    // Validación estricta
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('El importe debe ser un número positivo');
    }

    const orderIdStr = orderId.toString().padStart(12, '0');
    if (orderIdStr.length !== 12) {
      throw new Error('El número de pedido debe tener exactamente 12 dígitos');
    }

    // 1. Parámetros para redirección (sin datos sensibles)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(), // En céntimos
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Autorización
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '002' // Español
    };

    // 2. Convertir a Base64 (igual que en el ejemplo)
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de firma (adaptado del ejemplo de soporte)
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificación de clave (debe ser 24 bytes)
    if (secretKeyBytes.length !== 24) {
      console.error('Longitud de clave incorrecta:', secretKeyBytes.length);
      throw new Error('Configuración inválida de clave secreta');
    }

    // Cifrado 3DES (primeros 8 dígitos del orderId)
    const iv = Buffer.alloc(8, 0); // Vector de inicialización (ceros)
    const orderPrefix = orderIdStr.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false); // IMPORTANTE: Sin padding automático
    
    const encryptedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // Cálculo HMAC-SHA256 (igual que en el ejemplo)
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Respuesta final
    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debug: { // Solo para desarrollo
        amount: amount,
        orderId: orderIdStr,
        paramsJson: paramsJson,
        encryptedKey: encryptedKey.toString('hex')
      }
    });

  } catch (error) {
    console.error('Error en Redsys:', error);
    return NextResponse.json(
      {
        error: 'Error al procesar el pago',
        details: error instanceof Error ? error.message : 'Error desconocido',
        solution: [
          'Verifique que la clave secreta sea exactamente JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
          'El orderId debe tener exactamente 12 dígitos numéricos',
          'El amount debe ser un número positivo (ej: 50.00)',
          'Las URLs deben ser accesibles desde internet'
        ]
      },
      { status: 400 }
    );
  }
}