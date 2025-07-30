import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string;
  const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string;
  const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string;
  const REDSYS_URL = process.env.REDSYS_URL as string;

  const NOTIFICATION_URL = "https://www.alteabikeshop.com/api/notification";
  const URL_OK = "https://www.alteabikeshop.com/reserva-exitosa";
  const URL_KO = "https://www.alteabikeshop.com/reserva-fallida";

  try {
    const { amount, orderId, locale = 'es' } = await request.json();
    if (!amount || !orderId) throw new Error("Faltan 'amount' u 'orderId'");

    const amountInCents = Math.round(parseFloat(amount) * 100);
    const orderIdStr = orderId.toString().padStart(12, '0');

    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: "978",
      DS_MERCHANT_TRANSACTIONTYPE: "0",
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL: NOTIFICATION_URL,
      DS_MERCHANT_URLOK: `${URL_OK}?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${URL_KO}?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: "Alquiler de bicicletas",
    };

    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // Logging para verificación externa
    console.log("📦 merchantParams:", merchantParams);
    console.log("📦 paramsB64:", paramsB64);

    // Firma HMAC con 3DES
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0);
    const dataToEncrypt = REDSYS_MERCHANT_CODE + REDSYS_TERMINAL;
    const paddedData = dataToEncrypt.padEnd(Math.ceil(dataToEncrypt.length / 8) * 8, '\0');

    const cipher = crypto.createCipheriv('des-ede3-cbc', desKey, iv);
    cipher.setAutoPadding(false);
    const hmacKey = Buffer.concat([cipher.update(paddedData, 'utf8'), cipher.final()]);

    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    console.log("🔐 Firma generada:", signature);

    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: "HMAC_SHA256_V1"
    });

  } catch (error: any) {
    console.error("❌ Error en Redsys:", error.message);
    return NextResponse.json(
      { error: "Error al procesar el pago", details: error.message },
      { status: 500 }
    );
  }
}
