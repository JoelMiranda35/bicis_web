import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'
const REDSYS_PROD_URL = 'https://sis.redsys.es/sis/realizarPago'

// ✅ Clave en Base64 (como la que da el portal Redsys)
function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
  const key = Buffer.from(secretKeyB64, 'base64') // <- decode base64
  const iv = Buffer.alloc(8, 0)
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv)
  cipher.setAutoPadding(false)

  const orderIdPadded = orderId.slice(0, 8).padEnd(8, '\0')
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
}

function validateNumericField(value: string, length: number, fieldName: string): string {
  if (!value) throw new Error(`El campo ${fieldName} es requerido`)
  if (!/^\d+$/.test(value)) throw new Error(`El campo ${fieldName} debe contener solo dígitos`)
  if (value.length > length) throw new Error(`El campo ${fieldName} no puede exceder ${length} dígitos`)
  return value.padStart(length, '0')
}

export async function POST(req: Request) {
  let data: any = null

  try {
    data = await req.json()

    const requiredFields = [
      'orderId', 'amount', 'customerName', 'customerEmail',
      'customerPhone', 'customerDni', 'locale'
    ]

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Campo requerido faltante: ${field}`)
      }
    }

    const orderId = validateNumericField(data.orderId, 12, 'orderId')
    const amountInCents = Math.round(Number(data.amount) * 100)
    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('El importe debe ser un número positivo')
    }

    // 🔒 Usamos los datos que te dio Redsys directamente
    const merchantCode = '367064094'
    const terminal = '001'
    const secretKeyB64 = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG' // ya en base64

    const redsysUrl = process.env.NODE_ENV === 'production' ? REDSYS_PROD_URL : REDSYS_TEST_URL

    const merchantParams = {
      Ds_Merchant_Amount: amountInCents.toString(),
      Ds_Merchant_Order: orderId,
      Ds_Merchant_MerchantCode: merchantCode,
      Ds_Merchant_Currency: '978',
      Ds_Merchant_TransactionType: '0',
      Ds_Merchant_Terminal: terminal,
      Ds_Merchant_MerchantURL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/notification`,
      Ds_Merchant_UrlOK: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa`,
      Ds_Merchant_UrlKO: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida`,
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
        secretKey: secretKeyB64.slice(0, 5) + '...',
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
