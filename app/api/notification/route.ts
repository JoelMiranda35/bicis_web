import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
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
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    const paramsB64 = formData.get('Ds_MerchantParameters')?.toString()
    const signature = formData.get('Ds_Signature')?.toString()
    const signatureVersion = formData.get('Ds_SignatureVersion')?.toString()

    if (!paramsB64 || !signature || !signatureVersion) {
      return NextResponse.json(
        { error: 'Missing required parameters from Redsys' },
        { status: 400 }
      )
    }

    const paramsJson = Buffer.from(paramsB64, 'base64').toString('utf-8')
    const params = JSON.parse(paramsJson)

    const secretKeyB64 = process.env.REDSYS_SECRET_KEY || ''
    const calculatedSignature = calculateSignature(secretKeyB64, params.Ds_Order, paramsB64)

    if (calculatedSignature !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('reservations')
      .update({
        payment_status: params.Ds_Response <= 99 ? 'succeeded' : 'failed',
        status: params.Ds_Response <= 99 ? 'confirmed' : 'failed',
        ds_response_code: params.Ds_Response,
        ds_authorisation_code: params.Ds_AuthorisationCode || null,
        redsys_notification_received: true,
        redsys_notification_data: params,
        paid_amount: parseInt(params.Ds_Amount) / 100,
        paid_at: new Date().toISOString(),
        payment_date: params.Ds_Date ? new Date(params.Ds_Date).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.Ds_MerchantData)

    if (error) {
      console.error('Error updating reservation:', error)
      return NextResponse.json(
        { error: 'Error updating reservation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error processing notification:', error)
    return NextResponse.json(
      { error: 'Error processing notification', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}