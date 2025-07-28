import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createCipheriv, createHmac } from 'crypto';

export async function POST(request: Request) {
  // Configuración EXACTA según Redsys
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881',
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG', // Clave que te indicaron
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId } = await request.json();

    // Validación estricta como en el ejemplo
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('El importe debe ser un número positivo');
    }

    const orderIdStr = orderId.toString().padStart(12, '0');
    if (orderIdStr.length !== 12) {
      throw new Error('El orderId debe tener 12 dígitos exactos');
    }

    // 1. Parámetros como en el ejemplo de Redsys (pero sin datos sensibles)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '002'
    };

    // 2. Convertir a Base64 (igual que en su ejemplo)
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de firma SEGÚN SU EJEMPLO (adaptado a Node.js)
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificación de clave (debe ser 24 bytes)
    if (secretKeyBytes.length !== 24) {
      console.error('❌ Longitud incorrecta de clave:', secretKeyBytes.length, 'bytes (deben ser 24)');
      throw new Error('Clave secreta inválida');
    }

    // Cifrado 3DES (igual que en su función des_encrypt)
    const iv = Buffer.alloc(8, 0); // IV de ceros como en su código
    const orderPrefix = orderIdStr.slice(0, 8); // Primeros 8 dígitos
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix, 'utf8').copy(orderPadded);

    const cipher = createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false); // ZeroPadding como en su código
    const encryptedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    // HMAC-SHA256 (igual que en su ejemplo)
    const hmac = createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Mostrar TODOS los datos como en su ejemplo
    console.log('\n=== 🔍 DATOS COMPLETOS (como en el ejemplo Redsys) ===');
    console.log('1. Parámetros JSON:', merchantParams);
    console.log('2. Parámetros Base64:', paramsB64);
    console.log('3. Clave Secreta (Base64):', config.secretKey);
    console.log('4. Order Prefix (8 chars):', orderPrefix);
    console.log('5. Clave Cifrada (hex):', encryptedKey.toString('hex'));
    console.log('6. Firma Calculada:', signature);
    console.log('\n=== 🚀 DATOS PARA REDIRECCIÓN ===');
    console.log('Ds_MerchantParameters:', paramsB64);
    console.log('Ds_Signature:', signature);
    console.log('Ds_SignatureVersion: HMAC_SHA256_V1');

    // 5. Pausa para revisión (60 segundos en desarrollo)
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
    console.error('\n❌ ERROR:', error);
    return NextResponse.json(
      {
        error: 'Error en el proceso de pago',
        details: error instanceof Error ? error.message : String(error),
        solution: [
          '1. Verifica que la clave sea EXACTAMENTE: JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
          '2. El orderId debe tener 12 dígitos exactos',
          '3. El amount debe ser un número positivo',
          '4. Revisa la consola para ver los datos completos'
        ]
      },
      { status: 400 }
    );
  }
}