import { NextResponse } from 'next/server';
import crypto from 'crypto';

const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago';
const MERCHANT_CODE = '367064094'; // Reemplaza con tu código real
const TERMINAL = '001'; // Reemplaza con tu terminal real
const SECRET_KEY = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7'; // Clave de pruebas

// URLs - ¡VERIFICA QUE ESTAS URLS SEAN ACCESIBLES POR REDSYS!
const notificationUrl = 'https://alteabikeshop.com/api/notification'; // Debe ser pública
const siteUrl = 'https://alteabikeshop.com'; // Tu dominio principal

interface MerchantParams {
  DS_MERCHANT_AMOUNT: string;
  DS_MERCHANT_ORDER: string;
  DS_MERCHANT_MERCHANTCODE: string;
  DS_MERCHANT_CURRENCY: string;
  DS_MERCHANT_TRANSACTIONTYPE: string;
  DS_MERCHANT_TERMINAL: string;
  DS_MERCHANT_MERCHANTURL: string;
  DS_MERCHANT_URLOK: string;
  DS_MERCHANT_URLKO: string;
  DS_MERCHANT_CONSUMERLANGUAGE?: string;
  DS_MERCHANT_PRODUCTDESCRIPTION?: string;
  DS_MERCHANT_TITULAR?: string;
  DS_MERCHANT_MERCHANTDATA?: string;
}

export async function POST(request: Request) {
  try {
    const { amount, orderId, locale } = await request.json();

    // Validaciones robustas
    if (!amount || !orderId || !locale) {
      throw new Error('Faltan parámetros requeridos: amount, orderId o locale');
    }

    // Validación y conversión del amount
    const parsedAmount = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error(`Amount inválido (${amount}). Debe ser mayor que 0`);
    }

    // Convertir a céntimos (sin decimales)
    const amountInCents = Math.round(parsedAmount * 100).toString();
    
    // Formatear orderId (12 dígitos)
    const orderCode = orderId.toString().padStart(12, '0').slice(-12);

    // Parámetros obligatorios para Redsys
    const merchantParams: MerchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderCode,
      DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // 978 = EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // 0 = Pago estándar
      DS_MERCHANT_TERMINAL: TERMINAL,
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: `${siteUrl}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${siteUrl}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001', // 002=Español, 001=Inglés
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: 'Altea Bike Shop',
      DS_MERCHANT_MERCHANTDATA: orderId
    };

    // Convertir a JSON y luego a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 1. Derivación de clave 3DES (Paso crítico)
    const key = Buffer.from(SECRET_KEY, 'base64');
    const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0)); // ECB mode
    cipher.setAutoPadding(false);
    
    // Asegurar que orderCode tenga 8 bytes (rellenar con ceros si es necesario)
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderCode.slice(0, 8)).copy(orderPadded);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // 2. Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      url: REDSYS_TEST_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      testCard: {
        number: '4548812049400004',
        expiry: '12/2025',
        cvv: '123'
      },
      debug: { // Solo para desarrollo
        derivedKey: derivedKey.toString('hex'),
        paramsJson,
        orderCode
      }
    });

  } catch (error) {
    console.error('Error en /api/redsys:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido',
        debug: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : null
        } : undefined
      },
      { status: 500 }
    );
  }
}