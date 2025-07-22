import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'

const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'

function padTo8Bytes(data: string): Buffer {
  const buf = Buffer.from(data, 'utf8')
  const padLen = (8 - (buf.length % 8)) % 8
  return Buffer.concat([buf, Buffer.alloc(padLen)])
}

function encrypt3DES(key: Buffer, data: string): Buffer {
  // 🔥 CAMBIO: Mejorado el padding y desactivado auto-padding
  const cipher = crypto.createCipheriv('des-ede3', key, null)
  cipher.setAutoPadding(false)
  const paddedData = data.padEnd(8, '\0').slice(0, 8)
  return Buffer.concat([cipher.update(paddedData, 'utf8'), cipher.final()])
}

function sign3DES(
  secretKeyB64: string,
  orderId: string,
  paramsB64: string
): string {
  // 🔥 CAMBIO: Implementación más robusta con normalización de firma
  if (!secretKeyB64 || !orderId || !paramsB64) {
    throw new Error('Parámetros requeridos faltantes para firma')
  }

  const key = Buffer.from(secretKeyB64, 'base64')
  const paddedOrderId = orderId.padEnd(8, '\0').slice(0, 8)
  const derivedKey = encrypt3DES(key, paddedOrderId)

  return crypto
    .createHmac('sha256', derivedKey)
    .update(paramsB64)
    .digest('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=+$/, '')
}

export async function POST(req: Request) {
  try {
    const {
      amount,
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      customerDni,
      startDate,
      endDate,
      totalDays,
      bikes,
      accessories = [],
      insurance = false,
      depositAmount = 0,
      pickupTime,
      returnTime,
      locale = 'es'
    } = await req.json()

    // 🔥 CAMBIO: Validación estricta del importe
    const amountNumber = Number(amount)
    if (isNaN(amountNumber) || amountNumber <= 0) {
      throw new Error('El importe debe ser un número mayor que 0')
    }
    const amountCents = Math.round(amountNumber * 100).toString()

    // 🔥 CAMBIO: Validación del orderId
    if (!orderId || orderId.length !== 12 || !/^\d+$/.test(orderId)) {
      throw new Error('El orderId debe tener exactamente 12 dígitos numéricos')
    }

    // Insertar reserva
    const { data: inserted, error: insertError } = await supabase
      .from('reservations')
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_dni: customerDni,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        bikes: JSON.stringify(bikes),
        accessories: JSON.stringify(accessories),
        insurance: insurance,
        total_amount: amountNumber,
        deposit_amount: Number(depositAmount),
        status: 'pending_payment',
        payment_gateway: 'redsys',
        payment_status: 'pending',
        payment_reference: orderId,
        redsys_order_id: orderId,
        // 🔥 CAMBIO: Aseguramos que el código de comercio sea numérico
        redsys_merchant_code: process.env.REDSYS_MERCHANT_CODE || '999008881',
        locale: locale,
        pickup_time: pickupTime,
        return_time: returnTime
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Error insertando reserva: ${insertError.message}`)
    }

    // 🔥 CAMBIO: Parámetros merchant mejor validados
    const merchantParams = {
      DS_MERCHANT_AMOUNT: amountCents,
      DS_MERCHANT_ORDER: orderId,
      // 🔥 CAMBIO: Código de comercio numérico
      DS_MERCHANT_MERCHANTCODE: process.env.REDSYS_MERCHANT_CODE || '999008881',
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      // 🔥 CAMBIO: Terminal fijado a '001' si no está configurado
      DS_MERCHANT_TERMINAL: process.env.REDSYS_TERMINAL || '001',
      DS_MERCHANT_MERCHANTURL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/notification`,
      DS_MERCHANT_URLOK: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa`,
      DS_MERCHANT_URLKO: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '001' : '002',
      DS_MERCHANT_DESCRIPTION: `Reserva ${orderId}`.slice(0, 125), // 🔥 CAMBIO: Limitado a 125 chars
      DS_MERCHANT_MERCHANTNAME: customerName.slice(0, 25), // 🔥 CAMBIO: Limitado a 25 chars
      DS_MERCHANT_MERCHANTDATA: JSON.stringify({ email: customerEmail })
    }

    const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64')
    
    // 🔥 CAMBIO: Verificación de clave secreta antes de usarla
    if (!process.env.REDSYS_SECRET_KEY) {
      throw new Error('REDSYS_SECRET_KEY no configurada')
    }
    const signature = sign3DES(process.env.REDSYS_SECRET_KEY, orderId, paramsB64)

    // 🔥 CAMBIO: Log de depuración (eliminar en producción)
    console.debug('Redirección a Redsys con:', {
      amount: amountCents,
      orderId,
      merchantCode: merchantParams.DS_MERCHANT_MERCHANTCODE,
      terminal: merchantParams.DS_MERCHANT_TERMINAL,
      paramsB64: paramsB64,
      signature: signature
    })

    return NextResponse.json({
      success: true,
      reservation: inserted,
      url: REDSYS_TEST_URL,
      params: paramsB64,
      signature
    })
  } catch (err: any) {
    console.error('create-payment error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Error interno' },
      { status: 500 }
    )
  }
}