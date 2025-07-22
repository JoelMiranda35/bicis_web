import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Rellena datos a múltiplos de 8 bytes con '\0'
function padTo8Bytes(data: string): string {
  while (Buffer.byteLength(data) % 8 !== 0) data += '\0'
  return data
}

// Cifra en 3DES-ECB sin IV
function encrypt3DES(key: Buffer, data: string): Buffer {
  const padded = padTo8Bytes(data)
  const cipher = crypto.createCipheriv('des-ede3', key, null)
  return Buffer.concat([cipher.update(padded, 'utf8'), cipher.final()])
}

// Genera firma igual que Redsys: 3DES(secretKey, orderId) → HMAC-SHA256(paramsBase64)
function generateSignature(
  secretKeyB64: string,
  orderId: string,
  paramsBase64: string
): string {
  if (!secretKeyB64) throw new Error('REDSYS_SECRET_KEY no definida')
  if (!orderId)        throw new Error('orderId no definido')
  if (!paramsBase64)   throw new Error('paramsBase64 no definido')

  const key        = Buffer.from(secretKeyB64, 'base64')
  const derivedKey = encrypt3DES(key, orderId)
  const hmac       = crypto.createHmac('sha256', derivedKey)
  hmac.update(paramsBase64)
  return hmac.digest('base64')
}

export async function POST(request: NextRequest) {
  try {
    const formData        = await request.formData()
    const paramsB64       = formData.get('Ds_MerchantParameters')?.toString()
    const signatureRecvd  = formData.get('Ds_Signature')?.toString()
    const signatureVer    = formData.get('Ds_SignatureVersion')?.toString()

    if (!paramsB64)     throw new Error('Falta Ds_MerchantParameters')
    if (!signatureRecvd) throw new Error('Falta Ds_Signature')
    if (!signatureVer)   throw new Error('Falta Ds_SignatureVersion')
    if (!process.env.REDSYS_SECRET_KEY) 
      throw new Error('REDSYS_SECRET_KEY no definida')

    // Parsea payload
    const rawJson = Buffer.from(paramsB64, 'base64').toString('utf8')
    const params  = JSON.parse(rawJson)

    // Extrae orderId
    const orderId = params.DS_MERCHANT_ORDER
    if (!orderId) throw new Error('DS_MERCHANT_ORDER no presente')

    // Verifica firma
    const signatureCalc = generateSignature(
      process.env.REDSYS_SECRET_KEY,
      orderId,
      paramsB64
    )
    if (signatureCalc !== signatureRecvd) {
      throw new Error(
        `Firma inválida. Recibida: ${signatureRecvd}, Calculada: ${signatureCalc}`
      )
    }

    // Consulta depósito en efectivo existente
    const { data: existing, error: fetchErr } = await supabase
      .from('reservations')
      .select('deposit_amount')
      .eq('redsys_order_id', orderId)
      .single()
    if (fetchErr) {
      throw new Error(`Error leyendo depósito: ${fetchErr.message}`)
    }
    const deposit       = existing?.deposit_amount ?? 0
    const onlinePaid    = Number(params.Ds_Amount) / 100
    const totalPaid     = deposit + onlinePaid

    // Determina estado del pago
    const successCodes = ['0000', '0900', '0400']
    const status       = successCodes.includes(params.Ds_Response)
      ? 'succeeded'
      : 'failed'

    // Actualiza reserva
    const { data, error: supabaseError } = await supabase
      .from('reservations')
      .update({
        payment_status:            status,
        ds_response_code:          params.Ds_Response,
        paid_amount:               totalPaid,
        paid_at:
          params.Ds_Date && params.Ds_Hour
            ? `${params.Ds_Date}T${params.Ds_Hour}:00`
            : null,
        ds_authorisation_code:     params.Ds_AuthorisationCode,
        redsys_notification_data:  params,
        redsys_notification_received: true,
        updated_at:                new Date().toISOString(),
        ...(status === 'succeeded' && { status: 'confirmed' })
      })
      .eq('redsys_order_id', orderId)
      .select()

    if (supabaseError) {
      throw new Error(`Error al actualizar Supabase: ${supabaseError.message}`)
    }

    // Envío de email opcional
    if (status === 'succeeded' && data?.[0]?.customer_email) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:   data[0].customer_email,
            subject: 'Confirmación de pago',
            reservationData: data[0]
          })
        })
      } catch {}
    }

    return new NextResponse('OK', { status: 200 })
  } catch (err: any) {
    console.error('Error Redsys webhook:', err.message)
    await supabase.from('reservation_errors').insert({
      error_type: 'redsys_notification',
      error_data: JSON.stringify({
        message:   err.message,
        stack:     err.stack,
        timestamp: new Date().toISOString()
      })
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
