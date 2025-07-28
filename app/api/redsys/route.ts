import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración para entorno de pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881',
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

    // 1. Parámetros de la transacción CON LA URL api/notification
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`, // URL EXACTA
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '002'
    };

    // 2. Convertir a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de firma (método exacto)
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    if (secretKeyBytes.length !== 24) {
      console.error('Longitud de clave incorrecta:', secretKeyBytes.length);
      throw new Error('Configuración inválida de clave secreta');
    }

    const iv = Buffer.alloc(8, 0);
    const orderPrefix = orderIdStr.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false);
    const encryptedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Mostrar datos en consola para depuración
    console.log('\n=== DATOS QUE SE ENVIARÁN A REDSYS ===');
    console.log('URL:', config.redsysUrl);
    console.log('Params (JSON):', merchantParams);
    console.log('Params (Base64):', paramsB64);
    console.log('Firma calculada:', signature);
    console.log('Clave cifrada:', encryptedKey.toString('hex'));
    console.log('Tienes 60 segundos para revisar...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1'
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