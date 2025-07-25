import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'
const REDSYS_PROD_URL = 'https://sis.redsys.es/sis/realizarPago'

export const dynamic = 'force-dynamic'

function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
  try {
    const key = Buffer.from(secretKeyB64, 'base64')
    const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0))
    const orderIdPadded = orderId.padStart(12, '0').slice(0, 8)
    const derivedKey = Buffer.concat([
      cipher.update(orderIdPadded, 'utf8'),
      cipher.final()
    ])

    const hmac = crypto.createHmac('sha256', derivedKey)
    hmac.update(paramsB64)

    return hmac.digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch (error) {
    console.error('❌ Error calculating signature:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const requestData = await request.json()

    if (!requestData.amount || !requestData.orderId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: amount y orderId' },
        { status: 400 }
      )
    }

    const { data: reservation, error: dbError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', requestData.orderId)
      .single()

    if (dbError || !reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      )
    }

    const merchantCode = process.env.REDSYS_MERCHANT_CODE || '999008881'
    const terminal = process.env.REDSYS_TERMINAL?.padStart(3, '0') || '001'
    const secretKeyB64 = process.env.REDSYS_SECRET_KEY || ''
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alteabikeshop.com'

    if (!secretKeyB64) {
      return NextResponse.json(
        { error: 'REDSYS_SECRET_KEY no configurada en variables de entorno' },
        { status: 500 }
      )
    }

    const amountInCents = Math.round(parseFloat(requestData.amount) * 100)

    const orderId = reservation.redsys_order_id // ✅ YA está generado correctamente en page.tsx

    if (!/^\d{12}$/.test(orderId)) {
      return NextResponse.json(
        { error: `El redsys_order_id no es válido: "${orderId}"` },
        { status: 400 }
      )
    }

    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: terminal,
      DS_MERCHANT_MERCHANTURL: `${siteUrl}/api/notification`,
      DS_MERCHANT_URLOK: `${siteUrl}/reserva-exitosa`,
      DS_MERCHANT_URLKO: `${siteUrl}/reserva-fallida`,
      DS_MERCHANT_CONSUMERLANGUAGE: requestData.locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: reservation.customer_name || '',
      DS_MERCHANT_MERCHANTDATA: reservation.id
    }

    console.log("🔍 Params enviados a Redsys:", merchantParams)

    const jsonString = JSON.stringify(merchantParams)
    const paramsB64 = Buffer.from(jsonString).toString('base64')
    const signature = calculateSignature(secretKeyB64, orderId, paramsB64)

    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        redsys_order_id: orderId,
        redsys_amount: amountInCents,
        redsys_currency: merchantParams.DS_MERCHANT_CURRENCY,
        redsys_merchant_params: paramsB64,
        redsys_signature: signature,
        payment_gateway: 'redsys',
        payment_status: 'pending',
        status: 'pending_payment',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservation.id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      url: process.env.NODE_ENV === 'development' ? REDSYS_TEST_URL : REDSYS_PROD_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      orderId
    })

  } catch (error) {
    console.error('❌ Error en el procesamiento del pago:', error)
    return NextResponse.json(
      {
        error: 'Error al procesar el pago',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
