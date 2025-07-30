import { NextResponse } from 'next/server';
import crypto from 'crypto';

const REDSYS_SECRET_KEY = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG';
const REDSYS_MERCHANT_CODE = '367064094';
const REDSYS_TERMINAL = '1';
const REDSYS_URL = 'https://sis-t.redsys.es/sis/realizarPago';

export async function POST(request: Request) {
  try {
    const NOTIFICATION_URL = 'https://www.alteabikeshop.com/api/notification';
    const URL_OK = 'https://www.alteabikeshop.com/reserva-exitosa';
    const URL_KO = 'https://www.alteabikeshop.com/reserva-fallida';

    // Leer y validar payload
    const { amount, orderId: rawOrderId, locale = 'es' } = await request.json();
    
    if (!amount || !rawOrderId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos", details: "Se necesitan amount y orderId" },
        { status: 400 }
      );
    }

    // Formatear orderId (12 dígitos numéricos)
    const orderIdStr = rawOrderId.toString().replace(/\D/g, '').slice(-12).padStart(12, '0');
    const amountInCents = Math.round(parseFloat(amount) * 100).toString();

    // Parámetros del comercio
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago estándar
      DS_MERCHANT_TERMINAL: REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL: NOTIFICATION_URL,
      DS_MERCHANT_URLOK: `${URL_OK}?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${URL_KO}?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Reserva Altea Bike Shop',
    };

    // Codificar parámetros
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // Calcular firma HMAC-SHA256
    const key = Buffer.from(REDSYS_SECRET_KEY, 'base64');
    const iv = Buffer.alloc(8, 0);
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
    cipher.setAutoPadding(false);
    const hmacKey = Buffer.concat([
      cipher.update(orderIdStr.padEnd(16, '\0')), 
      cipher.final()
    ]);

    const hmac = crypto.createHmac('sha256', hmacKey)
      .update(paramsB64)
      .digest('base64');

    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature: hmac,
      signatureVersion: 'HMAC_SHA256_V1',
    });

  } catch (err: any) {
    console.error('Error en Redsys:', err);
    return NextResponse.json(
      {
        error: 'Error al procesar el pago',
        details: err.message,
      },
      { status: 500 }
    );
  }
}