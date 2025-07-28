import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Configuración EXACTA para pruebas
  const config = {
    redsysUrl: 'https://sis-t.redsys.es:25443/sis/realizarPago',
    merchantCode: '999008881', // Código de comercio de PRUEBAS
    terminal: '1',
    secretKey: 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG', // Clave EXACTA para pruebas
    siteUrl: 'https://www.alteabikeshop.com'
  };

  try {
    const { amount, orderId, locale = 'es' } = await request.json();

    // Validación EXTRA estricta
    if (!amount || !orderId) {
      throw new Error('Faltan parámetros requeridos (amount, orderId)');
    }

    const amountInCents = Math.round(Number(amount));
    const orderIdStr = orderId.toString().padStart(12, '0').slice(0, 12);

    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('El importe debe ser un número positivo');
    }

    if (orderIdStr.length !== 12 || !/^\d+$/.test(orderIdStr)) {
      throw new Error('El orderId debe tener exactamente 12 dígitos numéricos');
    }

    // 1. Parámetros EXACTOS como los espera Redsys
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderIdStr,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: '978', // 978 = Euros
      DS_MERCHANT_TRANSACTIONTYPE: '0', // 0 = Autorización
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${config.siteUrl}/reserva-exitosa?order=${orderIdStr}`,
      DS_MERCHANT_URLKO: `${config.siteUrl}/reserva-fallida?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '004' // 002=ES, 004=NL
    };

    // 2. Convertir parámetros a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 3. Cálculo de firma CORREGIDO (Método EXACTO de Redsys)
    const secretKeyBytes = Buffer.from(config.secretKey, 'base64');
    
    // Verificación CRÍTICA de la clave
    if (secretKeyBytes.length !== 24) {
      console.error('❌ Clave incorrecta. Longitud:', secretKeyBytes.length);
      throw new Error('La clave debe decodificar a 24 bytes (32 caracteres Base64)');
    }

    // Cifrado 3DES con ZeroPadding (EXACTO para Redsys)
    const iv = Buffer.alloc(8, 0); // Vector de inicialización lleno de ceros
    const cipher = crypto.createCipheriv('des-ede3-cbc', secretKeyBytes, iv);
    cipher.setAutoPadding(false); // ZeroPadding es CRÍTICO
    
    // Tomar primeros 8 dígitos del orderId
    const orderPrefix = orderIdStr.slice(0, 8);
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderPrefix).copy(orderPadded);

    const encryptedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', encryptedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // 4. Validación EXTRA antes de enviar
    if (!signature || !paramsB64) {
      throw new Error('Error al generar firma o parámetros');
    }

    // 5. Respuesta con datos para DEBUG
    return NextResponse.json({
      url: config.redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debugInfo: {
        originalAmount: amount,
        amountInCents,
        orderId: orderIdStr,
        merchantCode: config.merchantCode,
        terminal: config.terminal,
        paramsJson: merchantParams,
        encryptedKeyHex: encryptedKey.toString('hex'),
        paramsBase64: paramsB64
      }
    });

  } catch (error) {
    console.error('❌ Error en el procesamiento del pago:', {
      error,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      {
        error: 'No se puede realizar la operación',
        details: error instanceof Error ? error.message : 'Error desconocido',
        solution: [
          '1. Verifique que la clave sea EXACTAMENTE: JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG',
          '2. Confirme que el orderId tenga 12 dígitos exactos',
          '3. Asegúrese que el importe esté en céntimos (ej: 40.00€ = 4000)',
          '4. Compruebe que las URLs sean accesibles desde internet',
          '5. Contacte con soporte técnico de Redsys y proporcione:',
          '   - Código de comercio: 999008881',
          '   - Terminal: 1',
          '   - OrderId utilizado',
          '   - Hora del error: ' + new Date().toISOString()
        ]
      },
      { status: 400 }
    );
  }
}