import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const REDSYS_TEST_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago'
const REDSYS_PROD_URL = 'https://sis.redsys.es/sis/realizarPago'

// Función para calcular la firma HMAC-SHA256 de Redsys
function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
  // Convertir base64 URL-safe a base64 estándar
  const base64Key = secretKeyB64.replace(/-/g, '+').replace(/_/g, '/')
  const key = Buffer.from(base64Key, 'base64')

  const iv = Buffer.alloc(8, 0)
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv)
  cipher.setAutoPadding(false)

  // Padding a 8 bytes con ceros para orderId
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

// Valida que un campo numérico sea sólo dígitos y de longitud correcta
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

    // Campos obligatorios
    const requiredFields = [
      'orderId', 'amount', 'customerName', 'customerEmail',
      'customerPhone', 'customerDni', 'locale'
    ]

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Campo requerido faltante: ${field}`)
      }
    }

    // Validar y formatear orderId y amount
    const orderId = validateNumericField(data.orderId, 12, 'orderId')
    const amountInCents = Math.round(Number(data.amount) * 100)
    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('El importe debe ser un número positivo')
    }

    // Datos Redsys fijos que te dio Redsys (no los cambies)
    const merchantCode = '367064094'   // Código comercio
    const terminal = '001'             // Terminal (3 dígitos)
    const secretKeyB64 = 'JvJ4AULO/uZjBnFqWS8s46g94SbVJ4iG'  // Clave SHA-256 Base64 URL-safe desde Redsys

    const redsysUrl = process.env.NODE_ENV === 'production' ? REDSYS_PROD_URL : REDSYS_TEST_URL

    // Construcción parámetros Redsys en orden y con formatos requeridos
    const merchantParams = {
      Ds_Merchant_Amount: amountInCents.toString(),
      Ds_Merchant_Order: orderId,
      Ds_Merchant_MerchantCode: merchantCode,
      Ds_Merchant_Currency: '978', // EUR
      Ds_Merchant_TransactionType: '0', // autorización
      Ds_Merchant_Terminal: terminal,
      Ds_Merchant_MerchantURL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/notification`,
      Ds_Merchant_UrlOK: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-exitosa`,
      Ds_Merchant_UrlKO: `${process.env.NEXT_PUBLIC_SITE_URL}/reserva-fallida`,
      Ds_Merchant_ConsumerLanguage:
        data.locale === 'es' ? '001' : data.locale === 'en' ? '002' : '003',
      Ds_Merchant_ProductDescription: `Reserva ${orderId}`.substring(0, 125),
    }

    // Convertir a Base64 (JSON stringificado)
    const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64')

    // Calcular la firma HMAC-SHA256
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

    // Respuesta para frontend
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
