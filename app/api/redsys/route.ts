import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración desde .env
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string;
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string;
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string;
  const REDSYS_URL = process.env.REDSYS_URL as string;
  const NOTIFICATION_URL = process.env.NEXT_PUBLIC_REDSYS_NOTIFICATION_URL as string;
  const URL_OK = process.env.NEXT_PUBLIC_REDSYS_URL_OK as string;
  const URL_KO = process.env.NEXT_PUBLIC_REDSYS_URL_KO as string;

  try {
    // Parsear datos de la solicitud
    const { amount, orderId, locale = 'es' } = await request.json();
    
    // Validación básica
    if (!amount || !orderId) {
      throw new Error("Faltan parámetros requeridos: amount u orderId");
    }

    // Convertir amount a céntimos (Euros * 100) y asegurar que sea entero
    const amountInCents = Math.round(Number(amount)) * 100;
    
    // Asegurar que el orderId tenga exactamente 12 dígitos (rellenar con ceros a la izquierda)
    const orderIdStr = orderId.toString().padStart(12, '0');

    // 1. Preparar parámetros (según documentación Redsys)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: "978", // EUR
      DS_MERCHANT_TRANSACTIONTYPE: "0", // Pago normal
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL: NOTIFICATION_URL,
      DS_MERCHANT_URLOK: `${URL_OK}?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${URL_KO}?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001', // 002=español, 001=inglés
      DS_MERCHANT_PRODUCTDESCRIPTION: "Alquiler de bicicletas",
    };

    // 2. Codificar parámetros en Base64 URL Safe
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64url');

    // 3. Generación de clave HMAC (3DES)
    // - La clave debe ser decodificada desde Base64
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    
    // - IV de 8 bytes en cero (como especifica Redsys)
    const iv = Buffer.alloc(8, 0);
    
    // - Datos a cifrar: código de comercio + terminal (no el orderId como antes)
    const dataToEncrypt = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;
    
    // - Asegurar que la longitud sea múltiplo de 8 (ZeroPadding)
    const blockSize = 8;
    const padLength = blockSize - (dataToEncrypt.length % blockSize);
    const paddedData = dataToEncrypt + '\0'.repeat(padLength);

    // - Cifrar con 3DES en modo CBC
    const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    cipher.setAutoPadding(false); // Desactivar padding automático
    
    let encrypted = cipher.update(paddedData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const hmacKey = Buffer.from(encrypted, 'hex');

    // 4. Calcular firma HMAC-SHA256
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64url');

    // 5. Retornar respuesta
    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: "HMAC_SHA256_V1",
      debugInfo: process.env.NODE_ENV === 'development' ? {
        paramsJson,
        dataToEncrypt,
        paddedData,
        encryptedKey: encrypted,
        hmacKey: hmacKey.toString('hex')
      } : undefined
    });

  } catch (error: any) {
    console.error("Error en Redsys API:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: "Error al procesar el pago",
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    );
  }
}