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

    // 2. Validar firma
    const secretKey = process.env.REDSYS_SECRET_KEY;
    if (!secretKey) throw new Error('Clave secreta no configurada');

    const hmac = crypto.createHmac('sha256', secretKey);
    const signatureCalculated = hmac.update(paramsBase64).digest('base64');

    if (signatureReceived !== signatureCalculated) {
      throw new Error('Firma inválida');
    }

    // 3. Decodificar parámetros
    const paramsJson = Buffer.from(paramsBase64, 'base64').toString('utf-8');
    const params: RedsysNotification = JSON.parse(paramsJson);

    // 4. Determinar estado
    const successCodes = ['0000', '0900'];
    const status = successCodes.includes(params.Ds_Response) ? 'completed' : 'failed';

    // 5. Actualizar reserva
    const originalOrderId = params.Ds_Order.replace(/^DIRECT_/, '');
    
    const { error } = await supabase
      .from('reservations')
      .update({
        payment_status: status,
        payment_response_code: params.Ds_Response,
        payment_amount: parseInt(params.Ds_Amount) / 100,
        payment_date: params.Ds_Date && params.Ds_Hour ? `${params.Ds_Date}T${params.Ds_Hour}` : null,
        payment_authorization_code: params.Ds_AuthorisationCode,
        payment_raw_response: params,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' && { status: 'confirmed' })
      })
      .eq('redsys_order_id', originalOrderId);

    if (error) throw error;

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Error procesando notificación:', error);
    return new NextResponse('Error procesando notificación', { status: 500 });
  }
}