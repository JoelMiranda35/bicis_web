// /app/api/notification/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function encrypt3DES(key: Buffer, data: string): Buffer {
  const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0));
  return Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
}

function generateSignature(secretKey: string, orderId: string, paramsBase64: string): string {
  const key = Buffer.from(secretKey, 'base64');
  const derivedKey = encrypt3DES(key, orderId);
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
    const orderId = params.Ds_Order;

    const signatureCalculated = generateSignature(process.env.REDSYS_SECRET_KEY!, orderId, paramsBase64);

    if (signatureCalculated !== signatureReceived) {
      throw new Error(`Firma inválida. Recibida: ${signatureReceived}, Calculada: ${signatureCalculated}`);
    }

    const successCodes = ['0000', '0900', '0400'];
    const status = successCodes.includes(params.Ds_Response) ? 'completed' : 'failed';

    const { data, error: supabaseError } = await supabase
      .from('reservations')
      .update({
        payment_status: status,
        payment_response_code: params.Ds_Response,
        payment_amount: parseInt(params.Ds_Amount) / 100,
        payment_date: params.Ds_Date && params.Ds_Hour ? `${params.Ds_Date}T${params.Ds_Hour}:00` : null,
        payment_authorization_code: params.Ds_AuthorisationCode,
        payment_raw_response: params,
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
