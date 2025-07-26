import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Configuración FIJA para entorno de prueba
const REDSYS_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'; // URL de prueba
const MERCHANT_CODE = process.env.NEXT_PUBLIC_REDSYS_MERCHANT_CODE || '367064094'; // Tu código de comercio de prueba
const TERMINAL = '001';
const SECRET_KEY = process.env.REDSYS_SECRET_KEY || 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG'; // Tu clave secreta de prueba

// Tipos (se mantienen igual)
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
}

export async function POST(request: Request) {
  try {
    const { amount, orderId, locale } = await request.json();

    // Validación de parámetros (se mantiene igual)
    if (amount === undefined || amount === null) {
      throw new Error('El parámetro "amount" es requerido');
    }

    // Convertir amount a céntimos con validación
    const amountNumber = Number(amount);
    if (isNaN(amountNumber)) {
      throw new Error(`El importe proporcionado no es un número válido: ${amount}`);
    }

    if (amountNumber <= 0) {
      throw new Error(`El importe debe ser mayor que 0: ${amount}`);
    }

    const amountInCents = Math.round(amountNumber * 100).toString();

    // Validación y formateo del orderId
    const orderIdStr = orderId.toString();
    if (!orderIdStr || orderIdStr.length === 0) {
      throw new Error('El orderId no puede estar vacío');
    }

    // Limpiar orderId y asegurar 12 dígitos
    const orderCode = orderIdStr.replace(/\D/g, '').padStart(12, '0').slice(-12);
    if (orderCode.length !== 12) {
      throw new Error(`El orderId debe poder convertirse a 12 dígitos. Valor recibido: ${orderId}`);
    }

    // Construcción de parámetros para Redsys
    const merchantParams: MerchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents,
      DS_MERCHANT_ORDER: orderCode,
      DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago estándar
      DS_MERCHANT_TERMINAL: TERMINAL,
      DS_MERCHANT_MERCHANTURL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/redsys/notification`,
      DS_MERCHANT_URLOK: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '002' : '001', // 002=Español
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: 'Altea Bike Shop'
    };

    // 1. Convertir parámetros a JSON y luego a Base64
    const paramsJson = JSON.stringify(merchantParams);
    const paramsB64 = Buffer.from(paramsJson).toString('base64');

    // 2. Derivación de clave HMAC (3DES + SHA256)
    const secretKeyBytes = Buffer.from(SECRET_KEY, 'base64');
    
    if (secretKeyBytes.length !== 24) {
      throw new Error(`La clave secreta debe tener 24 bytes después de decodificar. Longitud actual: ${secretKeyBytes.length}`);
    }

    // Cifrado 3DES para derivación de clave
    const cipher = crypto.createCipheriv('des-ede3', secretKeyBytes, Buffer.alloc(0));
    cipher.setAutoPadding(false);
    
    // Preparar orderCode para cifrado (8 bytes)
    const orderPadded = Buffer.alloc(8, 0);
    Buffer.from(orderCode.slice(0, 8)).copy(orderPadded);
    
    const derivedKey = Buffer.concat([
      cipher.update(orderPadded),
      cipher.final()
    ]);

    // 3. Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(paramsB64);
    const signature = hmac.digest('base64');

    // Datos de depuración (siempre activos en este modo)
    const debugInfo = {
      requestData: { amount, orderId, locale },
      processedData: {
        amountInCents,
        orderCode,
        merchantParams,
        paramsJson,
        paramsB64,
        derivedKey: derivedKey.toString('hex'),
        signature
      },
      environment: {
        merchantCode: MERCHANT_CODE,
        terminal: TERMINAL,
        secretKey: '***' + SECRET_KEY.slice(-4), // Muestra solo últimos 4 caracteres por seguridad
        redsysUrl: REDSYS_URL,
        note: 'MODO PRUEBA ACTIVADO - Siempre usando entorno de pruebas'
      }
    };

    return NextResponse.json({
      success: true,
      url: REDSYS_URL, // Siempre usa la URL de prueba
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      debug: debugInfo // Siempre muestra datos de depuración
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    console.error('Error en integración Redsys (Pruebas):', {
      error: errorMessage,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        debug: {
          advice: 'Verifique: 1) Clave secreta 2) Formato de parámetros 3) Codificación Base64',
          environment: {
            merchantCode: MERCHANT_CODE,
            terminal: TERMINAL,
            redsysUrl: REDSYS_URL
          }
        }
      },
      { status: 500 }
    );
  }
}