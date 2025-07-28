import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración EXACTA para pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881',
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId, locale = 'es' } = await request.json();

    // Validación EXTRA estricta
    const amountInCents = Math.round(Number(amount) * 100);
    const orderIdStr = orderId.toString().padStart(12, '0').slice(0, 12);

    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('Amount must be positive (ej: 40 = 40€)');
    }

    if (!/^\d{12}$/.test(orderIdStr)) {
      throw new Error('OrderId must be exactly 12 digits');
    }

    // 1. Parámetros con URLs exactas
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001'
    };

    // 2. Conversión a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de firma CON VERIFICACIÓN EXTRA
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificación CRÍTICA de la clave
    if (secretKeyBytes.length !== 24) {
      const errorMsg = `Clave inválida. Longitud: ${secretKeyBytes.length} bytes (deben ser 24)`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Cifrado 3DES con verificación
    const iv = Buffer.alloc(8, 0);
    const orderPrefix = orderIdStr.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false);
    const encryptedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    // HMAC-SHA256 con verificación
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. MOSTRAR TODOS LOS DATOS EN CONSOLA
    console.log('\n\n=== DATOS COMPLETOS PARA REDSYS ===');
    console.log('1. Configuración:', {
      url: config.redsysUrl,
      merchantCode: config.merchantCode,
      terminal: config.terminal,
      secretKey: config.secretKey,
      secretKeyBytes: secretKeyBytes.toString('hex')
    });
    console.log('2. Datos recibidos:', { amount, orderId, locale });
    console.log('3. Parámetros generados:', merchantParams);
    console.log('4. JSON para Base64:', paramsJson);
    console.log('5. Parámetros en Base64:', paramsB64);
    console.log('6. Cálculo de firma:', {
      orderPrefix,
      encryptedKey: encryptedKey.toString('hex'),
      signature
    });
    console.log('\n=== RESUMEN PARA REDSYS ===');
    console.log('Ds_MerchantParameters:', paramsB64);
    console.log('Ds_Signature:', signature);
    console.log('Ds_SignatureVersion: HMAC_SHA256_V1');

    // 5. Pausa para revisión (60 segundos solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('\n⏳ Tienes 60 segundos para revisar los datos...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }

    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1'
    });

  } catch (error) {
    console.error('\n❌ ERROR EN EL PROCESO:', error);
    return NextResponse.json(
      {
        error: 'Error al procesar el pago',
        details: error instanceof Error ? error.message : String(error),
        solution: [
          '1. Verificar que la clave secreta sea EXACTAMENTE: JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
          '2. El orderId debe ser 12 DÍGITOS exactos (ej: "833793237889")',
          '3. El amount debe ser un número (ej: 40 para 40€)',
          '4. Las URLs deben ser accesibles (verificar api/notification)',
          '5. Revisar la consola para ver los datos completos enviados'
        ]
      },
      { status: 400 }
    );
  }
}