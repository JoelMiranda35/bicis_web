import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Configuración de AlteaBikeShop
const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago';
const MERCHANT_CODE = '367064094'; // Código de comercio de Altea
const TERMINAL = '001'; // Terminal de Altea
const SECRET_KEY = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7'; // Clave de pruebas de Altea

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

    // Validaciones robustas para AlteaBikeShop
    if (!amount || !orderId) {
      throw new Error('Faltan parámetros: amount (importe) u orderId (ID de reserva)');
    }

    // Convertir amount a céntimos (formato Redsys)
    const parsedAmount = parseFloat(String(amount).replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error(`Importe inválido (${amount}). Debe ser mayor que 0`);
    }
    const amountInCents = Math.round(parsedAmount * 100).toString();

    // Formatear orderId (12 dígitos exactos)
    const orderCode = orderId.toString().replace(/\D/g, '').padStart(12, '0').slice(-12);
    if (orderCode.length !== 12) {
      throw new Error('El ID de reserva debe convertirse a 12 dígitos');
    }

    // Parámetros específicos para AlteaBikeShop
    const merchantParams: MerchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderCode,
      DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago estándar
      DS_MERCHANT_TERMINAL: TERMINAL,
      DS_MERCHANT_MERCHANTURL: 'https://alteabikeshop.com/api/notification', // URL de notificación de Altea
      DS_MERCHANT_URLOK: 'https://alteabikeshop.com/reserva-exitosa', // Página de éxito
      DS_MERCHANT_URLKO: 'https://alteabikeshop.com/reserva-fallida', // Página de error
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001', // 002=Español
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas - AlteaBikeShop',
      DS_MERCHANT_TITULAR: 'Altea Bike Shop',
      DS_MERCHANT_MERCHANTDATA: orderId // Pasamos el ID original como metadata
    };

    // Convertir parámetros a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 1. Derivación de clave 3DES (Clave de Altea)
    const key = Buffer.from(SECRET_KEY, 'utf8'); // ¡Clave como UTF-8!
    const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0));
    cipher.setAutoPadding(false);
    
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderCode.slice(0, 8), 'utf8').copy(orderPadded);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // 2. Firma HMAC-SHA256
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64')
      .replace(/\+/g, '-') // Compatibilidad con Redsys
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Respuesta para Postman
    return NextResponse.json({
      success: true,
      url: REDSYS_TEST_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      testCard: { // Tarjeta de pruebas para Altea
        number: '4548812049400004',
        expiry: '12/2025',
        cvv: '123'
      },
      debug: process.env.NODE_ENV === 'development' ? {
        derivedKey: derivedKey.toString('hex'),
        paramsJson,
        orderCode
      } : undefined
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