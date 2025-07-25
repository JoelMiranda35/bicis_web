import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// URLs para desarrollo y producción
const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'
const REDSYS_PROD_URL = 'https://sis.redsys.es/sis/realizarPago'

export const dynamic = 'force-dynamic'

/**
 * Calcula la firma HMAC SHA256 según especificación Redsys
 */
function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
  try {
    // 1. Decodificar clave secreta desde Base64
    const key = Buffer.from(secretKeyB64, 'base64')
    
    // 2. Cifrado 3DES (ECB) del orderId (primeros 8 dígitos)
    const cipher = crypto.createCipheriv('des-ede3', key, Buffer.alloc(0))
    const orderIdPadded = orderId.padStart(12, '0').slice(0, 8)
    const derivedKey = Buffer.concat([
      cipher.update(orderIdPadded, 'utf8'),
      cipher.final()
    ])

    // 3. Calcular HMAC-SHA256 de los parámetros
    const hmac = crypto.createHmac('sha256', derivedKey)
    hmac.update(paramsB64)

    // 4. Formatear según requerimientos Redsys
    return hmac.digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch (error) {
    console.error('❌ Error calculando firma:', error)
    throw new Error('SIS0042 - Error en cálculo de firma')
  }
}

export async function POST(request: Request) {
  try {
    const requestData = await request.json()

    // Validación de campos requeridos
    if (!requestData.amount || !requestData.orderId || !requestData.locale) {
      throw new Error('Faltan parámetros requeridos: amount, orderId o locale')
    }

    // Obtener reserva desde Supabase
    const { data: reservation, error: dbError } = await supabase
      .from('reservations')
      .select('id, customer_name, redsys_order_id')
      .eq('id', requestData.orderId)
      .single()

    if (dbError || !reservation) {
      throw new Error('No se encontró la reserva')
    }

    // Configuración de Redsys
    const merchantCode = process.env.REDSYS_MERCHANT_CODE || '367064094'
    const terminal = process.env.REDSYS_TERMINAL?.padStart(3, '0') || '001'
    const secretKeyB64 = process.env.REDSYS_SECRET_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://AlteaBikeShop.com'

    if (!secretKeyB64) {
      throw new Error('La clave secreta de Redsys (REDSYS_SECRET_KEY) no está configurada')
    }

    // Validar y formatear el monto
    const amount = parseFloat(requestData.amount)
    if (isNaN(amount) || amount <= 0) {
      throw new Error('El monto debe ser un número positivo')
    }
    const amountInCents = Math.round(amount * 100)

    // Validar orderId (12 dígitos)
    const orderId = reservation.redsys_order_id
    if (!/^\d{12}$/.test(orderId)) {
      throw new Error(`El orderId ${orderId} no es válido (debe tener 12 dígitos)`)
    }

    // Parámetros para Redsys (formato exacto requerido)
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountInCents.toString(),
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: merchantCode,
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_TRANSACTIONTYPE: '0', // Pago estándar
      DS_MERCHANT_TERMINAL: terminal,
      DS_MERCHANT_MERCHANTURL: `${siteUrl}/api/redsys/notification`,
      DS_MERCHANT_URLOK: `${siteUrl}/reserva-exitosa?order=${orderId}`,
      DS_MERCHANT_URLKO: `${siteUrl}/reserva-fallida?order=${orderId}`,
      DS_MERCHANT_CONSUMERLANGUAGE: requestData.locale === 'es' ? '002' : '001', // 002=ES, 001=EN
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
      DS_MERCHANT_TITULAR: reservation.customer_name || '',
      DS_MERCHANT_MERCHANTDATA: reservation.id
    }

    // Convertir parámetros a JSON y luego a Base64
    const paramsJson = JSON.stringify(merchantParams)
    const paramsB64 = Buffer.from(paramsJson).toString('base64')
    
    // Calcular firma HMAC
    const signature = calculateSignature(secretKeyB64, orderId, paramsB64)

    // Actualizar reserva en Supabase
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        redsys_amount: amountInCents,
        redsys_currency: '978',
        redsys_merchant_params: paramsB64,
        redsys_signature: signature,
        updated_at: new Date().toISOString(),
        payment_status: 'pending',
        status: 'pending_payment'
      })
      .eq('id', reservation.id)

    if (updateError) throw updateError

    // Determinar URL según entorno
    const isDevelopment = process.env.NODE_ENV === 'development'
    const redsysUrl = isDevelopment ? REDSYS_TEST_URL : REDSYS_PROD_URL

    console.log(`Redirigiendo a Redsys (${isDevelopment ? 'TEST' : 'PROD'}):`, {
      orderId,
      amount: amountInCents,
      url: redsysUrl,
      paramsJson // Para debug
    })

    return NextResponse.json({
      success: true,
      url: redsysUrl,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
      orderId
    })

  } catch (error) {
    console.error('❌ Error en el procesamiento del pago:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar el pago',
        details: error instanceof Error ? error.message : String(error),
        code: 'SIS0042'
      },
      { status: 500 }
    )
  }
}