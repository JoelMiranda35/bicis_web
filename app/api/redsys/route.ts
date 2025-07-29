import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración de claves
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string;
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string;
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string;
  const REDSYS_URL = "https://sis-t.redsys.es:25443/sis/realizarPago";

  try {
    // Parsear datos de la solicitud
    const { amount, orderId } = await request.json();
    const amountInCents = Math.round(Number(amount) * 100);
    const orderIdStr = orderId.toString().padStart(12, '0');

    // 1. Preparar parámetros
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
      DS_MERCHANT_CONSUMERLANGUAGE: "002",
      DS_MERCHANT_PRODUCTDESCRIPTION: "Alquiler de bicicletas",
      DS_MERCHANT_TITULAR: "TITULAR"
    };

    // 2. Codificar parámetros
    const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64url');

    // 3. Generación de clave HMAC (3DES)
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0); // IV de 8 bytes en cero
    
    // Solución al error: Asegurar longitud correcta del dato a cifrar
    const dataToEncrypt = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;
    const blockSize = 8; // Para 3DES
    const padLength = blockSize - (dataToEncrypt.length % blockSize);
    const paddedData = dataToEncrypt + String.fromCharCode(padLength).repeat(padLength);

    const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    cipher.setAutoPadding(false); // Desactivar padding automático
    
    let encrypted = cipher.update(paddedData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const hmacKey = Buffer.from(encrypted, 'hex');

    // 4. Calcular firma HMAC-SHA256
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64url');

    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: "HMAC_SHA256_V1"
    });

  } catch (error: any) {
    console.error("Error completo:", error);
    return NextResponse.json(
      { 
        error: "Error al procesar el pago",
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}