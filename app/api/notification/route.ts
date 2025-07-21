import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper para rellenar a múltiplo de 8 bytes con \0
function padTo8Bytes(data: string): string {
  while (Buffer.byteLength(data) % 8 !== 0) {
    data += '\0';
  }
  return data;
}

function encrypt3DES(key: Buffer, data: string): Buffer {
  const paddedData = padTo8Bytes(data);
  const cipher = crypto.createCipheriv('des-ede3', key, null); // null = ECB mode sin IV
  return Buffer.concat([cipher.update(paddedData, 'utf8'), cipher.final()]);
}

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
    const formData = await request.formData();
    const paramsBase64 = formData.get('Ds_MerchantParameters')?.toString() || '';
    const signatureReceived = formData.get('Ds_Signature')?.toString() || '';

    if (!paramsBase64 || !signatureReceived) {
      throw new Error('Faltan parámetros o firma');
    }

    const paramsJson = Buffer.from(paramsBase64, 'base64').toString('utf-8');
    const params = JSON.parse(paramsJson);

    // Padding a 12 caracteres con ceros a la izquierda para orderId
    const orderId = params.Ds_Order.padStart(12, '0');

    const signatureCalculated = generateSignature(process.env.REDSYS_SECRET_KEY!, orderId, paramsBase64);

    // Logs para debug
    console.log('OrderId para firma:', orderId);
    console.log('Params Base64:', paramsBase64);
    console.log('Firma recibida:', signatureReceived);
    console.log('Firma calculada:', signatureCalculated);

    if (signatureCalculated !== signatureReceived) {
      throw new Error(`Firma inválida. Recibida: ${signatureReceived}, Calculada: ${signatureCalculated}`);
    }

    const successCodes = ['0000', '0900', '0400'];
    const status = successCodes.includes(params.Ds_Response) ? 'completed' : 'failed';

    const { data, error: supabaseError } = await supabase
      .from('reservations')
      .update({
        payment_status: status,
        ds_response_code: params.Ds_Response,
        payment_amount: parseInt(params.Ds_Amount) / 100,
        payment_date: params.Ds_Date && params.Ds_Hour ? `${params.Ds_Date}T${params.Ds_Hour}:00` : null,
        ds_authorisation_code: params.Ds_AuthorisationCode,
        redsys_notification_data: params,
        redsys_notification_received: true,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' && { status: 'confirmed' })
      })
      .eq('redsys_order_id', orderId)
      .select();

    if (supabaseError) {
      throw new Error(`Error al actualizar Supabase: ${supabaseError.message}`);
    }

    console.log('Notificación Redsys procesada correctamente:', data);
    return new NextResponse('OK', { status: 200 });
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Error desconocido');
    console.error('Error en notificación Redsys:', error.message);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
