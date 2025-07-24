import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'
const REDSYS_PROD_URL = 'https://sis.redsys.es/sis/realizarPago'

// Calcula la firma HMAC-SHA256 para Redsys
function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
  const base64Key = secretKeyB64.replace(/-/g, '+').replace(/_/g, '/')
  const key = Buffer.from(base64Key, 'base64')

  const iv = Buffer.alloc(8, 0)
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv)
  cipher.setAutoPadding(false)

  const orderIdPadded = orderId.slice(0, 8).padEnd(8, '\0')

  const derivedKey = Buffer.concat([
    cipher.update(orderIdPadded, 'utf8'),
    cipher.final(),
  ])

  const hmac = crypto.createHmac('sha256', derivedKey)
  hmac.update(paramsB64)

  return hmac
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(req: Request) {
  let data: any = null

  try {
    data = await req.json()

    const requiredFields = [
      'amount', 'customerName', 'customerEmail',
      'customerPhone', 'customerDni', 'locale'
    ]

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Campo requerido faltante: ${field}`)
      }
    }

    const amountInCents = Math.round(Number(data.amount) * 100)
    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('El importe debe ser un número positivo mayor a cero')
    }

    // ✅ Generamos el Order ID automáticamente (12 dígitos)
    const rawOrderId = Date.now().toString()
    const orderId = rawOrderId.slice(-12)

    // ✅ Leemos variables Redsys
    const merchantCode = process.env.REDSYS_MERCHANT_CODE
    const terminal = process.env.REDSYS_TERMINAL?.padStart(3, '0') // Asegura 3 dígitos
    const secretKeyB64 = process.env.REDSYS_SECRET_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!merchantCode || !terminal || !secretKeyB64 || !siteUrl) {
      throw new Error('Faltan variables de entorno necesarias para Redsys')
    }

    const redsysUrl = process.env.NODE_ENV === 'production' ? REDSYS_PROD_URL : REDSYS_TEST_URL

    const merchantParams = {
      Ds_Merchant_Amount: amountInCents.toString(),
      Ds_Merchant_Order: orderId,
      Ds_Merchant_MerchantCode: merchantCode,
      Ds_Merchant_Currency: '978',
      Ds_Merchant_TransactionType: '0',
      Ds_Merchant_Terminal: terminal,
      Ds_Merchant_MerchantURL: `${siteUrl}/api/notification`,
      Ds_Merchant_UrlOK: `${siteUrl}/reserva-exitosa`,
      Ds_Merchant_UrlKO: `${siteUrl}/reserva-fallida`,
      Ds_Merchant_ConsumerLanguage:
        data.locale === 'es' ? '001' : data.locale === 'en' ? '002' : '003',
      Ds_Merchant_ProductDescription: `Reserva ${orderId}`.substring(0, 125),
    }

    const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64')
    const signature = calculateSignature(secretKeyB64, orderId, paramsB64)

    if (process.env.NODE_ENV === 'development') {
      console.log('Datos enviados a Redsys:', {
        url: redsysUrl,
        merchantParams,
        paramsB64,
        signature,
        orderId,
      })
    }

    return NextResponse.json({
      success: true,
      url: redsysUrl,
      Ds_MerchantParameters: paramsB64,
      Ds_Signature: signature,
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
    })
  } catch (error: any) {
    console.error('Error en create-payment:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development'
          ? {
              message: error.message,
              stack: error.stack,
              receivedData: data,
              timestamp: new Date().toISOString(),
            }
          : undefined,
      },
      { status: 500 }
    )
  }
}
