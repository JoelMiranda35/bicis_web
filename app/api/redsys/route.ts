import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // 1. Configuración de claves (usa tu clave REAL JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG)
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string; // Clave SHA-256 de Redsys
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string; // Ej: "367064094"
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string; // Ej: "001"
  const REDSYS_URL = "https://sis-t.redsys.es:25443/sis/realizarPago"; // URL de TEST
  
  // 2. Validación de variables
  if (!REDSYS_SECRET_KEY || !REDSYS_MERCHANT_CODE || !REDSYS_TERMINAL) {
    return NextResponse.json(
      { error: "Configuración incompleta. Verifica REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE y REDSYS_TERMINAL" },
      { status: 500 }
    );
  }

  try {
    // 3. Parsear datos de la solicitud
    const { amount, orderId, locale = 'es' } = await request.json();
    const amountInCents = Math.round(Number(amount) * 100);
    const orderIdStr = orderId.toString().padStart(12, '0');

    // 4. Parámetros EXACTOS como en el ejemplo de Redsys
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: "978",
      DS_MERCHANT_TRANSACTIONTYPE: "0",
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL: "https://www.alteabikeshop.com/api/notification",
      DS_MERCHANT_URLOK: `https://www.alteabikeshop.com/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `https://www.alteabikeshop.com/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: "002", // 002 = inglés
      DS_MERCHANT_PRODUCTDESCRIPTION: "Alquiler de bicicletas",
      DS_MERCHANT_TITULAR: "TEST USER" // Campo obligatorio
    };

    // 5. Codificar parámetros en Base64URL
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64url');

    // 6. Generar clave HMAC (3DES + SHA256)
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0); // Vector de inicialización (8 bytes en 0)

    const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    cipher.setAutoPadding(false); // ¡Desactivar padding!

  const dataToEncrypt = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;


let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
encrypted += cipher.final('hex');
const hmacKey = Buffer.from(encrypted, 'hex'); // Ahora es válido
    // 7. Calcular firma HMAC-SHA256
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64url');

    // 8. Respuesta
    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: "HMAC_SHA256_V1"
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al procesar el pago", details: error.message },
      { status: 500 }
    );
  }
}