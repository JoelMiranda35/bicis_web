import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string;
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string;
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string;
  const REDSYS_URL = process.env.REDSYS_URL as string;
  const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL as string;

  if (!REDSYS_SECRET_KEY || !REDSYS_MERCHANT_CODE || !REDSYS_TERMINAL || !REDSYS_URL || !NEXT_PUBLIC_SITE_URL) {
    console.error("Faltan variables de entorno esenciales para Redsys.");
    return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 });
  }

  try {
    const { amount, orderId, locale = 'es' } = await request.json();
    console.log("Amount recibido en /api/redsys:", amount);

    // Validación estricta
    if (!amount || !orderId) {
      throw new Error('Faltan parámetros requeridos (amount, orderId)');
    }

    const amountInCents = Math.round(Number(amount) * 100);
    const orderIdStr = orderId.toString().padStart(12, '0').slice(0, 12);

    console.log("Amount convertido a céntimos:", amountInCents);

    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('El importe debe ser un número positivo');
    }

    if (orderIdStr.length !== 12 || !/^\d+$/.test(orderIdStr)) {
      throw new Error('El orderId debe tener exactamente 12 dígitos numéricos');
    }

    // URLs de callback
    const notificationUrl = `${NEXT_PUBLIC_SITE_URL}/api/notification`;
    const urlOk = `${NEXT_PUBLIC_SITE_URL}/reserva-exitosa?order=${orderIdStr}`;
    const urlKo = `${NEXT_PUBLIC_SITE_URL}/reserva-fallida?order=${orderIdStr}`;

    // Parámetros para Redsys (modificados según ejemplo)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(), // Convertido a string
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: urlOk,
      DS_MERCHANT_URLKO: urlKo,
      DS_MERCHANT_CONSUMERLANGUAGE: '002', // Fijo a '002' como en el ejemplo
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: 'TEST USER' // Campo añadido
    };

    // Debug: Mostrar parámetros generados
    console.log("MerchantParams:", JSON.stringify(merchantParams, null, 2));

    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64url');

    // Lógica de firma
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0);

    const dataToEncryptForHmacKey = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;
    const cipherForHmacKey = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    let hmacKey = cipherForHmacKey.update(dataToEncryptForHmacKey, 'utf8');
    hmacKey = Buffer.concat([hmacKey, cipherForHmacKey.final()]);

    // Debug: Mostrar clave HMAC
    console.log("HMAC Key (hex):", hmacKey.toString('hex'));

    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64url');

    // Debug: Mostrar firma generada
    console.log("Firma generada:", signature);

    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debug: {
        hmacKey: hmacKey.toString('hex'), // Solo para desarrollo
        paramsJson // Solo para desarrollo
      }
    });

  } catch (error: any) { 
    console.error('Error en el procesamiento del pago:', error);
    return NextResponse.json(
      {
        error: 'No se puede realizar la operación',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}