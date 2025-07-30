// app/api/redsys/route.ts

import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const REDSYS_SECRET_KEY = process.env.REDSYS_SECRET_KEY as string
    const REDSYS_MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE as string
    const REDSYS_TERMINAL = process.env.REDSYS_TERMINAL as string
    const REDSYS_URL = process.env.REDSYS_URL as string

    const NOTIFICATION_URL = 'https://www.alteabikeshop.com/api/notification'
    const URL_OK = 'https://www.alteabikeshop.com/reserva-exitosa'
    const URL_KO = 'https://www.alteabikeshop.com/reserva-fallida'

    // Leemos el payload
    const { amount, orderId: rawOrderId, locale = 'es' } = await request.json()
    if (!amount || !rawOrderId) {
      return NextResponse.json(
        { error: "Faltan 'amount' u 'orderId'" },
        { status: 400 }
      )
    }

    // Asegurar DS_MERCHANT_ORDER de 12 dígitos numéricos
    const digitsOnly = rawOrderId.toString().replace(/\D/g, '')
    const orderIdStr =
      digitsOnly.length >= 12
        ? digitsOnly.slice(-12)
        : digitsOnly.padStart(12, '0')

    // Convertimos euros a céntimos
    const amountInCents = Math.round(parseFloat(amount) * 100).toString()

    const merchantParams = {
      DS_MERCHANT_AMOUNT:       amountInCents,
      DS_MERCHANT_ORDER:        orderIdStr,
      DS_MERCHANT_MERCHANTCODE: REDSYS_MERCHANT_CODE,
      DS_MERCHANT_CURRENCY:     '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL:       REDSYS_TERMINAL,
      DS_MERCHANT_MERCHANTURL:    NOTIFICATION_URL,
      DS_MERCHANT_URLOK:          `${URL_OK}?order=${orderIdStr}`,
      DS_MERCHANT_URLKO:          `${URL_KO}?order=${orderIdStr}`,
      DS_MERCHANT_CONSUMERLANGUAGE:
        locale === 'es' ? '002' : '001',
      DS_MERCHANT_PRODUCTDESCRIPTION: 'Alquiler de bicicletas',
    }

    // Serializar y codificar
    const paramsJson = JSON.stringify(merchantParams)
    const paramsB64 = Buffer.from(paramsJson).toString('base64')

    // Derivar clave HMAC con 3DES
    const desKey = Buffer.from(REDSYS_SECRET_KEY, 'base64')
    const iv = Buffer.alloc(8, 0)
    const dataToEncrypt =
      REDSYS_MERCHANT_CODE + REDSYS_TERMINAL
    const padded = dataToEncrypt.padEnd(
      Math.ceil(dataToEncrypt.length / 8) * 8,
      '\0'
    )
    const cipher = crypto.createCipheriv(
      'des-ede3-cbc',
      desKey,
      iv
    )
    cipher.setAutoPadding(false)
    const hmacKey = Buffer.concat([
      cipher.update(padded, 'utf8'),
      cipher.final(),
    ])

    // Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', hmacKey)
    hmac.update(paramsB64)
    const signature = hmac.digest('base64')

    // Devolvemos al cliente los datos para el formulario Redsys
    return NextResponse.json({
      url: REDSYS_URL,
      params: paramsB64,
      signature,
      signatureVersion: 'HMAC_SHA256_V1',
    })
  } catch (err: any) {
    console.error('❌ Error en Redsys:', err)
    return NextResponse.json(
      {
        error: 'Error al procesar el pago',
        details: err.message,
      },
      { status: 500 }
    )
  }
}
