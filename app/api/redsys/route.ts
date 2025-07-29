import { NextResponse } from 'next/server';
import crypto from 'crypto'; // Usando el módulo crypto nativo de Node.js

export async function POST(request: Request) {
  // Configuración de variables de entorno (asegúrate de que estén disponibles en Vercel)
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string;
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string;
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string;
  const REDSYS_URL = process.env.REDSYS_URL as string; // URL del TPV (pruebas o producción)
  const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL as string; // Para construir las URLs de callback

  // Asegúrate de que todas las variables de entorno necesarias estén definidas
  if (!REDSYS_SECRET_KEY || !REDSYS_MERCHANT_CODE || !REDSYS_TERMINAL || !REDSYS_URL || !NEXT_PUBLIC_SITE_URL) {
    console.error("Faltan variables de entorno esenciales para Redsys.");
    return NextResponse.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 });
  }

  try {
    const { amount, orderId, locale = 'es' } = await request.json();

    // Validación EXTRA estricta
    if (!amount || !orderId) {
      throw new Error('Faltan parámetros requeridos (amount, orderId)');
    }

    const amountInCents = Math.round(Number(amount) * 100); // Redsys espera céntimos
    // Aseguramos 12 dígitos y truncamos si es necesario. Ya se hace en frontend, pero es buena práctica aquí.
    const orderIdStr = orderId.toString().padStart(12, '0').slice(0, 12); 

    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('El importe debe ser un número positivo');
    }

    if (orderIdStr.length !== 12 || !/^\d+$/.test(orderIdStr)) {
      throw new Error('El orderId debe tener exactamente 12 dígitos numéricos');
    }

    // URLs de callback (asegúrate de que sean accesibles desde Redsys)
    const notificationUrl = `${NEXT_PUBLIC_SITE_URL}/api/notification`;
    const urlOk = `${NEXT_PUBLIC_SITE_URL}/reserva-exitosa`;
    const urlKo = `${NEXT_PUBLIC_SITE_URL}/reserva-fallida`;

    // 1. Parámetros EXACTOS como los espera Redsys
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Autorización
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL, // Usa el valor de la variable de entorno (esperamos '001')
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: urlOk,
      DS_MERCHANT_URLKO: urlKo,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '001' : '002', // 001=es, 002=en
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas', 
    };

    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64url'); // Base64 URL-safe para Redsys

    // --- LÓGICA DE FIRMA CORREGIDA PARA Redsys con crypto de Node.js ---

    // Paso 1: Decodificar la clave secreta de Redsys (REDSYS_SECRET_KEY) de Base64
    // Esta es la clave binaria de 24 bytes para TripleDES
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64'); 
    const iv = Buffer.alloc(8, 0); // IV de 8 bytes de ceros

    // Paso 2: Concatenar el código de comercio y el terminal
    const dataToEncryptForHmacKey = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;

    // Paso 3: Cifrar la cadena concatenada con TripleDES para obtener la clave del HMAC
    const cipherForHmacKey = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    let hmacKey = cipherForHmacKey.update(dataToEncryptForHmacKey, 'utf8');
    hmacKey = Buffer.concat([hmacKey, cipherForHmacKey.final()]);
    // `hmacKey` es ahora la clave final para el HMAC SHA-256

    // Paso 4: Calcular HMAC SHA-256
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64url'); // La firma final en Base64 URL-safe

    // --- FIN LÓGICA DE FIRMA CORREGIDA ---

    // 5. Respuesta con datos para el frontend
    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      // Puedes añadir debugInfo si lo necesitas para el desarrollo, pero elimínalo en producción
      debugInfo: {
        originalAmount: amount,
        amountInCents,
        orderId: orderIdStr,
        merchantCode: REDSYS_MERCHANT_CODE,
        terminal: REDSYS_TERMINAL,
        paramsJson: merchantParams,
        hmacKeyHex: hmacKey.toString('hex'), // La clave binaria usada para el HMAC
        paramsBase64: paramsB64
      }
    });

  } catch (error: any) { 
    console.error('❌ Error en el procesamiento del pago:', {
      error,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      {
        error: 'No se puede realizar la operación',
        details: error instanceof Error ? error.message : 'Error desconocido',
        solution: [
          '1. Verifique que la clave secreta de Redsys sea correcta y esté en el formato Base64 adecuado en .env.',
          '2. Confirme que el código de comercio y el terminal de Redsys sean correctos en .env (terminal debe ser \'001\' si es el caso).',
          '3. Asegúrese que el orderId tenga 12 dígitos exactos.',
          '4. Compruebe que el importe esté en céntimos (ej: 40.00€ = 4000).',
          '5. Las URLs de notificación y de éxito/error deben ser accesibles desde Redsys.',
          '6. Contacte con soporte técnico de Redsys y proporcione:',
          `   - Código de comercio: ${REDSYS_MERCHANT_CODE}`,
          `   - Terminal: ${REDSYS_TERMINAL}`,
          `   - OrderId: [el orderId específico de la transacción que falla]`,
          `   - Error recibido: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          `   - La firma generada por su sistema para esa transacción y los parámetros Base64 que la acompañan.`
        ]
      },
      { status: 500 }
    );
  }
}