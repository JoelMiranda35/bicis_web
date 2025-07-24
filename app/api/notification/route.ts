import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function verifySignature(
  secretKeyB64: string,
  orderId: string,
  paramsB64: string,
  receivedSignature: string
): boolean {
  try {
    // 1. Decodificar clave
    const key = Buffer.from(secretKeyB64, 'base64')
    const iv = Buffer.alloc(8, 0)
    
    // 2. Derivar clave HMAC
    const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv)
    cipher.setAutoPadding(false)
    const derivedKey = Buffer.concat([
      cipher.update(orderId.slice(0, 8).padEnd(8, '\0'), 'utf8'),
      cipher.final()
    ])

    // 3. Calcular firma esperada
    const expectedSignature = crypto
      .createHmac('sha256', derivedKey)
      .update(paramsB64)
      .digest('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')

    // 4. Comparación segura contra ataques de timing
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    )

  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  let paramsB64: string | null = null;
  let signatureRecvd: string | null = null;

  try {
    const formData = await request.formData()
    paramsB64 = formData.get('Ds_MerchantParameters')?.toString() || null
    signatureRecvd = formData.get('Ds_Signature')?.toString() || null
    const signatureVer = formData.get('Ds_SignatureVersion')?.toString()

    if (!paramsB64 || !signatureRecvd || !signatureVer) {
      throw new Error('Faltan parámetros requeridos en la notificación')
    }

    // Parsear parámetros
    const params = JSON.parse(Buffer.from(paramsB64, 'base64').toString())
    const orderId = params.DS_MERCHANT_ORDER

    // Verificar firma
    if (!verifySignature(
      process.env.REDSYS_SECRET_KEY!,
      orderId,
      paramsB64,
      signatureRecvd
    )) {
      throw new Error('Firma inválida en la notificación')
    }

    // Procesar notificación
    const responseCode = params.Ds_Response
    const isSuccess = ['0000', '0900', '0400'].includes(responseCode)

    await supabase
      .from('reservations')
      .update({
        payment_status: isSuccess ? 'succeeded' : 'failed',
        ds_response_code: responseCode,
        paid_amount: isSuccess ? Number(params.Ds_Amount) / 100 : 0,
        paid_at: params.Ds_Date && params.Ds_Hour 
          ? `${params.Ds_Date}T${params.Ds_Hour}:00` 
          : null,
        ds_authorisation_code: params.Ds_AuthorisationCode,
        redsys_notification_data: params,
        updated_at: new Date().toISOString()
      })
      .eq('redsys_order_id', orderId)

    return new NextResponse('OK', { status: 200 })

  } catch (error: any) {
    console.error('Error processing notification:', error)
    
    await supabase.from('payment_errors').insert({
      error_type: 'redsys_notification',
      error_message: error.message,
      error_data: JSON.stringify({
        params: paramsB64,
        signature: signatureRecvd,
        timestamp: new Date().toISOString()
      })
    })

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}