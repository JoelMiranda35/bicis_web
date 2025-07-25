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
    console.error('Error calculating signature:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const requestData = await request.json()
    
    // Validar datos requeridos
    if (!requestData.amount || !requestData.orderId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: amount y orderId' },
        { status: 400 }
      )
    }

    // Obtener la reserva de la base de datos
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

    // Configuración Redsys desde variables de entorno
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

    // Convertir amount a céntimos (Redsys espera sin decimales)
    const amountInCents = Math.round(parseFloat(requestData.amount) * 100)
    const orderId = reservation.id.replace(/-/g, '').slice(0, 12).padStart(12, '0')

    // Parámetros para Redsys según tu configuración
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: merchantCode,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago normal
      DS_MERCHANT_TERMINAL: terminal,
      DS_MERCHANT_MERCHANTURL: `${siteUrl}/api/notification`, // URL de notificación configurada
      DS_MERCHANT_URLOK: `${siteUrl}/reserva-exitosa`, // URL OK configurada
      DS_MERCHANT_URLKO: `${siteUrl}/reserva-fallida`, // URL KO configurada
      DS_MERCHANT_CONSUMERLANGUAGE: requestData.locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: reservation.customer_name || '',
      DS_MERCHANT_MERCHANTDATA: reservation.id
    }

    // Convertir a JSON y luego a Base64
    const jsonString = JSON.stringify(merchantParams)
    const paramsB64 = Buffer.from(jsonString).toString('base64')

    // Calcular firma
    const signature = calculateSignature(secretKeyB64, orderId, paramsB64)

    // Actualizar reserva con datos de Redsys
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

    if (updateError) {
      throw updateError
    }

    // Respuesta con datos para redirección a Redsys
    return NextResponse.json({
      success: true,
      url: process.env.NODE_ENV === 'development' ? REDSYS_TEST_URL : REDSYS_PROD_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      orderId: orderId
    })

  } catch (error) {
    console.error('Error en el procesamiento del pago:', error)
    return NextResponse.json(
      { 
        error: 'Error al procesar el pago', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}