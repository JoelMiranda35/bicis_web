import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface RedsysNotification {
  Ds_Date?: string;
  Ds_Hour?: string;
  Ds_Amount: string;
  Ds_Currency: string;
  Ds_Order: string;
  Ds_MerchantCode: string;
  Ds_Terminal: string;
  Ds_Response: string;
  Ds_TransactionType: string;
  Ds_SecurePayment?: string;
  Ds_MerchantData?: string;
  Ds_Card_Country?: string;
  Ds_AuthorisationCode?: string;
  Ds_ConsumerLanguage?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Parsear notificación
    const formData = await request.formData();
    const paramsBase64 = formData.get('Ds_MerchantParameters')?.toString() || '';
    const signatureReceived = formData.get('Ds_Signature')?.toString() || '';

    if (!paramsBase64 || !signatureReceived) {
      throw new Error('Datos incompletos: faltan parámetros o firma');
    }

    // 2. Validar firma
    const secretKey = process.env.REDSYS_SECRET_KEY;
    if (!secretKey) throw new Error('Clave secreta no configurada');

    const signatureCalculated = crypto
      .createHmac('sha256', secretKey)
      .update(paramsBase64)
      .digest('base64url');

    if (signatureReceived !== signatureCalculated) {
      throw new Error(`Firma inválida. Recibida: ${signatureReceived}, Calculada: ${signatureCalculated}`);
    }

    // 3. Decodificar parámetros
    let params: RedsysNotification;
    try {
      const paramsJson = Buffer.from(paramsBase64, 'base64').toString('utf-8');
      params = JSON.parse(paramsJson);
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Error desconocido al decodificar parámetros');
      throw new Error(`Error al decodificar parámetros: ${error.message}`);
    }

    // 4. Determinar estado
    const successCodes = ['0000', '0900', '0400'];
    const status = successCodes.includes(params.Ds_Response) ? 'completed' : 'failed';

    // 5. Actualizar reserva
    const originalOrderId = params.Ds_Order.replace(/^DIRECT_/, '');
    if (!originalOrderId) throw new Error('OrderId inválido');

    const { data, error: supabaseError } = await supabase
      .from('reservations')
      .update({
        payment_status: status,
        payment_response_code: params.Ds_Response,
        payment_amount: parseInt(params.Ds_Amount) / 100,
        payment_date: params.Ds_Date && params.Ds_Hour 
          ? `${params.Ds_Date}T${params.Ds_Hour}:00`
          : null,
        payment_authorization_code: params.Ds_AuthorisationCode,
        payment_raw_response: params,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' && { status: 'confirmed' })
      })
      .eq('redsys_order_id', originalOrderId)
      .select();

    if (supabaseError) {
      console.error('Error Supabase:', supabaseError);
      throw new Error(`Error al actualizar Supabase: ${supabaseError.message}`);
    }

    console.log('Actualización exitosa:', data);
    return new NextResponse('OK', { status: 200 });

  } catch (e) {
    const error = e instanceof Error ? e : new Error('Error desconocido');
    console.error('Error en /api/notification:', error.message);
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Error procesando notificación',
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}