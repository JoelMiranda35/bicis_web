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
  const cipher = crypto.createCipheriv('des-ede3', key, null)
  return Buffer.concat([cipher.update(padTo8Bytes(data)), cipher.final()])
}

function sign3DES(
  secretKeyB64: string,
  orderId: string,
  paramsB64: string
): string {
  const key        = Buffer.from(secretKeyB64, 'base64')
  const derivedKey = encrypt3DES(key, orderId)
  return crypto.createHmac('sha256', derivedKey).update(paramsB64).digest('base64')
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

    // Insertar reserva sin especificar `id`
    const { data: inserted, error: insertError } = await supabase
      .from('reservations')
      .insert({
        customer_name:       customerName,
        customer_email:      customerEmail,
        customer_phone:      customerPhone,
        customer_dni:        customerDni,
        start_date:          startDate,
        end_date:            endDate,
        total_days:          totalDays,
        bikes:               JSON.stringify(bikes),
        accessories:         JSON.stringify(accessories),
        insurance:           insurance,
        total_amount:        Number(amount),
        deposit_amount:      Number(depositAmount),
        status:              'pending_payment',
        payment_gateway:     'redsys',
        payment_status:      'pending',
        payment_reference:   orderId,
        redsys_order_id:     orderId,
        redsys_merchant_code: process.env.REDSYS_MERCHANT_CODE,
        locale:              locale,
        pickup_time:         pickupTime,
        return_time:         returnTime
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Error insertando reserva: ${insertError.message}`)
    }

    // Preparar Redsys
    const amountCents = Math.round(amount * 100).toString()
    const merchantParams = {
      DS_MERCHANT_AMOUNT:           amountCents,
      DS_MERCHANT_ORDER:            orderId,
      DS_MERCHANT_MERCHANTCODE:     process.env.REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY:         '978',
      DS_MERCHANT_TRANSACTIONTYPE:  '0',
      DS_MERCHANT_TERMINAL:         process.env.REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL:      `${process.env.NEXT_PUBLIC_SITE_URL}/api/notification`,
      DS_MERCHANT_URLOK:            `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa`,
      DS_MERCHANT_URLKO:            `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida`,
      DS_MERCHANT_CONSUMERLANGUAGE: locale === 'es' ? '001' : '002',
      DS_MERCHANT_DESCRIPTION:      `Reserva ${orderId}`,
      DS_MERCHANT_MERCHANTNAME:     customerName,
      DS_MERCHANT_MERCHANTDATA:     JSON.stringify({ email: customerEmail })
    }

    const paramsB64  = Buffer.from(JSON.stringify(merchantParams)).toString('base64')
    const signature  = sign3DES(
      process.env.REDSYS_SECRET_KEY!,
      orderId,
      paramsB64
    )

    return NextResponse.json({
      success:     true,
      reservation: inserted,
      url:         REDSYS_TEST_URL,
      params:      paramsB64,
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

