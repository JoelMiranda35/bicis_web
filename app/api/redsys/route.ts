import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración para pruebas (usa tus datos reales)
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881', // Tu código de comercio
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG', // TU CLAVE REAL
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId } = await request.json();

    // Validación
    if (!amount || isNaN(amount)) throw new Error('Amount invalid');
    if (!orderId || orderId.length !== 12) throw new Error('OrderId must be 12 digits');

    // 1. Parámetros para redirección (sin datos sensibles)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(amount * 100).toString(), // En céntimos
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/redsys/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida`,
      DS_MERCHANT_CONSUMERLANGUAGE: '002' // Español
    };

    // 2. Convertir a Base64 (como en el ejemplo)
    const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64');

    // 3. Calcular firma (adaptado del ejemplo)
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Cifrado 3DES (como en el ejemplo)
    const iv = Buffer.alloc(8, 0);
    const orderPrefix = orderId.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false);
    const encryptedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    // HMAC-SHA256 (como en el ejemplo)
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}