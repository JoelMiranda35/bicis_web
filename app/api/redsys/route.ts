import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // 1. Configuración desde .env
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string;
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string;
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string;
  const REDSYS_URL = process.env.REDSYS_URL as string;

  // 2. URLs fijas (¡CON www!)
  const NOTIFICATION_URL = "https://www.alteabikeshop.com/api/notification";
  const URL_OK = "https://www.alteabikeshop.com/reserva-exitosa";
  const URL_KO = "https://www.alteabikeshop.com/reserva-fallida";

  try {
    // 3. Parsear y validar datos de la solicitud
    const { amount, orderId, locale = 'es' } = await request.json();
    
    if (!amount || !orderId) {
      throw new Error("Faltan 'amount' u 'orderId'");
    }

    // 4. Formatear datos para Redsys
    const amountInCents = Math.round(Number(amount)) * 100; // Convertir a céntimos
    const orderIdStr = orderId.toString().padStart(12, '0'); // 12 dígitos

    // 5. Parámetros del comercio (¡CON www!)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: "978", // EUR
      DS_MERCHANT_TRANSACTIONTYPE: "0", // Pago normal
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL: NOTIFICATION_URL,
      DS_MERCHANT_URLOK: `${URL_OK}?order=${orderIdStr}`, // Incluye orderId como query param
      DS_MERCHANT_URLKO: `${URL_KO}?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001', // 002=español
      DS_MERCHANT_PRODUCTDESCRIPTION: "Alquiler de bicicletas",
    };

    // 6. Codificar parámetros en Base64 URL-Safe
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64url');

    // 7. Generar clave HMAC (3DES)
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0); // IV de ceros
    const dataToEncrypt = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL; // "367064094001"

    // Aplicar ZeroPadding (múltiplo de 8 bytes)
    const blockSize = 8;
    const padLength = blockSize - (dataToEncrypt.length % blockSize);
    const paddedData = dataToEncrypt + '\0'.repeat(padLength);

    // Cifrar con 3DES-CBC
    const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    cipher.setAutoPadding(false);
    let encrypted = cipher.update(paddedData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const hmacKey = Buffer.from(encrypted, 'hex');

    // 8. Calcular firma HMAC-SHA256
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64url');

    // 9. Retornar respuesta para redirección
    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: "HMAC_SHA256_V1",
      debugInfo: process.env.NODE_ENV === 'development' ? {
        amountInCents,
        orderIdStr,
        dataToEncrypt,
        hmacKey: hmacKey.toString('hex'),
      } : undefined,
    });

  } catch (error: any) {
    console.error("Error en Redsys:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: "Error al procesar el pago",
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      { status: 500 }
    );
  }
}