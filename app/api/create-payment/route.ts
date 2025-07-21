import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface PaymentRequest {
  amount: number;
  orderId: string;
  customerEmail: string;
  customerName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCVV: string;
  cardName: string;
  currency?: string;
}

// Helper para rellenar a múltiplo de 8 bytes con \0
function padTo8Bytes(data: string): string {
  while (Buffer.byteLength(data) % 8 !== 0) {
    data += '\0';
  }
  return data;
}

// Helper para encriptación 3DES
function encrypt3DES(key: Buffer, data: string): Buffer {
  const paddedData = padTo8Bytes(data);
  const cipher = crypto.createCipheriv('des-ede3', key, null);
  return Buffer.concat([cipher.update(paddedData, 'utf8'), cipher.final()]);
}

// Helper para generar firma HMAC SHA256 según especificación Redsys
function generateSignature(secretKey: string, orderId: string, paramsBase64: string): string {
  const key = Buffer.from(secretKey, 'base64');
  const paddedOrderId = padTo8Bytes(orderId);
  const derivedKey = encrypt3DES(key, paddedOrderId);
  const hmac = crypto.createHmac('sha256', derivedKey);
  hmac.update(paramsBase64);
  return hmac.digest('base64');
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REDSYS_MERCHANT_CODE || !process.env.REDSYS_SECRET_KEY) {
      throw new Error('Configuración de Redsys incompleta');
    }

    const requestBody: PaymentRequest = await request.json();

    if (!requestBody.amount || requestBody.amount <= 0) {
      throw new Error('El importe debe ser mayor que cero');
    }

    if (!requestBody.orderId) {
      throw new Error('Se requiere un ID de pedido');
    }

    if (process.env.NODE_ENV === 'development') {
      const cleanedCardNumber = requestBody.cardNumber.replace(/\s+/g, '');
      const testCards = ['4548812049400004', '5406608000000006'];
      if (!testCards.includes(cleanedCardNumber)) {
        return NextResponse.json(
          { 
            success: false,
            error: 'En desarrollo use las tarjetas de prueba: 4548 8120 4940 0004 (Visa) o 5406 6080 0000 0006 (Mastercard)'
          },
          { status: 400 }
        );
      }
    }

    // Formatear expiry date MMYY
    const [expMonth, expYear] = requestBody.cardExpiry.match(/.{1,2}/g) || [];
    const expiryDate = `${expMonth}${expYear.slice(-2)}`;

    // Aquí aplicamos padding y formateamos el orderId para que tenga 12 caracteres con ceros
    const paddedOrderId = requestBody.orderId.padStart(12, '0').slice(0, 12);

    const merchantParams = {
      DS_MERCHANT_AMOUNT: Math.round(requestBody.amount * 100).toString(),
      DS_MERCHANT_ORDER: paddedOrderId,
      DS_MERCHANT_MERCHANTCODE: process.env.REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: process.env.REDSYS_TERMINAL || '1',
      DS_MERCHANT_MERCHANTURL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/notification`,
      DS_MERCHANT_URLOK: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa?order=${requestBody.orderId}`,
      DS_MERCHANT_URLKO: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida?order=${requestBody.orderId}`,
      DS_MERCHANT_PAN: requestBody.cardNumber.replace(/\s+/g, ''),
      DS_MERCHANT_EXPIRYDATE: expiryDate,
      DS_MERCHANT_CVV2: requestBody.cardCVV,
      DS_MERCHANT_TITULAR: requestBody.cardName.trim(),
      DS_MERCHANT_CONSUMERLANGUAGE: '1',
      DS_MERCHANT_PRODUCTDESCRIPTION: `Alquiler de bicicletas (Ref: ${requestBody.orderId})`
    };

    const paramsBase64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64');
    const signature = generateSignature(process.env.REDSYS_SECRET_KEY, paddedOrderId, paramsBase64);

    // Registrar intento de pago
    const { error: dbError } = await supabase
      .from('payment_attempts')
      .insert({
        order_id: requestBody.orderId,
        amount: requestBody.amount,
        customer_email: requestBody.customerEmail,
        status: 'pending',
        payment_data: merchantParams,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error al registrar el intento de pago:', dbError);
    }

    return NextResponse.json({
      success: true,
      paymentData: {
        Ds_SignatureVersion: 'HMAC_SHA256_V1',
        Ds_MerchantParameters: paramsBase64,
        Ds_Signature: signature
      },
      redirectUrl: process.env.NODE_ENV === 'development'
        ? 'https://sis-t.redsys.es:25443/sis/realizarPago'
        : 'https://sis.redsys.es/sis/realizarPago'
    });

  } catch (error: any) {
    await supabase.from('payment_errors').insert({
      error_type: 'payment_processing',
      error_data: JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error procesando el pago'
      },
      { status: 500 }
    );
  }
}
