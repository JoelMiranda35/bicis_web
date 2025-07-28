import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración para pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881',
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId } = await request.json();

    // Validación
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const orderIdStr = orderId.toString().padStart(12, '0');
    if (orderIdStr.length !== 12) {
      throw new Error('OrderId must be exactly 12 digits');
    }

    // 1. Parámetros de la transacción
    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(Number(amount) * 100).toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida`,
      DS_MERCHANT_CONSUMERLANGUAGE: '002'
    };

    // 2. Convertir a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Calcular firma
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    if (secretKeyBytes.length !== 24) {
      console.error('Invalid key length:', secretKeyBytes.length);
      throw new Error('Invalid secret key configuration');
    }

    const iv = Buffer.alloc(8, 0);
    const orderPrefix = orderIdStr.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false);
    const encryptedKey = Buffer.concat([cipher.update(orderPadded), cipher.final()]);

    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. MOSTRAR DATOS COMPLETOS EN CONSOLA
    console.log('\n\n=== DATOS COMPLETOS ENVIADOS A REDSYS ===');
    console.log('URL:', config.redsysUrl);
    console.log('\n=== PARÁMETROS ENVIADOS ===');
    console.log('Params JSON:', paramsJson);
    console.log('Params Base64:', paramsB64);
    console.log('\n=== CÁLCULO DE FIRMA ===');
    console.log('Secret Key (Base64):', config.secretKey);
    console.log('Secret Key (Bytes):', secretKeyBytes.toString('hex'));
    console.log('Order Prefix:', orderPrefix);
    console.log('Encrypted Key:', encryptedKey.toString('hex'));
    console.log('Signature:', signature);
    console.log('\n=== RESULTADO FINAL ===');
    console.log('Ds_MerchantParameters:', paramsB64);
    console.log('Ds_Signature:', signature);
    console.log('Ds_SignatureVersion: HMAC_SHA256_V1');
    console.log('\nTienes 60 segundos para revisar los datos...\n');

    // Espera 60 segundos solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      await new Promise(resolve => setTimeout(resolve, 60000));
    }

    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1'
    });

  } catch (error) {
    console.error('\n=== ERROR EN EL PROCESO ===');
    console.error(error);
    return NextResponse.json(
      { 
        error: 'Payment processing error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}