import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Asegúrate de que estas variables de entorno existan en Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Calcula la firma HMAC SHA-256 para Redsys (la misma lógica que en el inicio de pago).
 * @param {string} secretKeyB64 - La clave secreta de Redsys en formato Base64.
 * @param {string} orderId - El número de pedido (Ds_Merchant_Order) de 12 dígitos.
 * @param {string} paramsB64 - Los parámetros Ds_MerchantParameters ya codificados en Base64 URL-safe.
 * @returns {string} La firma HMAC SHA-256 en Base64 URL-safe.
 */
function calculateSignature(secretKeyB64: string, orderId: string, paramsB64: string): string {
    // Paso 1: Obtener la clave de operación (K)
    // Descifrar REDSYS_SECRET_KEY (Base64) usando a sí misma como clave TripleDES (DES-EDE3-CBC)
    const keyBytes = Buffer.from(secretKeyB64, 'base64'); // Clave secreta Base64 como buffer (es el ciphertext Y la clave)
    const iv = Buffer.alloc(8, 0); // IV de 8 bytes de ceros, según manual Redsys

    // Crear descifrador para obtener la clave de operación
    const decipher = crypto.createDecipheriv('des-ede3-cbc', keyBytes, iv);
    let keyOperation = decipher.update(keyBytes); // El texto a descifrar es la propia `keyBytes`.
    keyOperation = Buffer.concat([keyOperation, decipher.final()]);
    // `keyOperation` es ahora la "clave de operación" (K) que Redsys espera

    // Paso 2: Obtener la clave para el HMAC
    // Encriptar el orderId con la clave de operación (K)
    const cipherForHmacKey = crypto.createCipheriv('des-ede3-cbc', keyOperation, iv);
    let hmacKey = cipherForHmacKey.update(orderId, 'utf8'); // Usamos el orderId COMPLETO aquí
    hmacKey = Buffer.concat([hmacKey, cipherForHmacKey.final()]);
    // `hmacKey` es ahora la clave final para el HMAC SHA-256

    // Paso 3: Calcular HMAC SHA-256
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(paramsB64);
    
    // Devolver la firma en Base64 URL-safe
    return hmac.digest('base64url');
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        
        const paramsB64 = formData.get('Ds_MerchantParameters')?.toString();
        const signature = formData.get('Ds_Signature')?.toString();
        const signatureVersion = formData.get('Ds_SignatureVersion')?.toString();

        if (!paramsB64 || !signature || !signatureVersion) {
            console.error('Missing required parameters from Redsys notification');
            return NextResponse.json(
                { error: 'Missing required parameters from Redsys' },
                { status: 400 }
            );
        }

        const paramsJson = Buffer.from(paramsB64, 'base64url').toString('utf-8'); // Usar 'base64url' para decodificar
        const params = JSON.parse(paramsJson);

        // Asegúrate de que la clave secreta esté disponible en el entorno de Vercel
        const secretKeyB64 = process.env.REDSYS_SECRET_KEY;
        if (!secretKeyB64) {
            console.error('REDSYS_SECRET_KEY is not defined in environment variables');
            return NextResponse.json(
                { error: 'Server configuration error: REDSYS_SECRET_KEY missing' },
                { status: 500 }
            );
        }

        // El Ds_Order en la notificación debe ser el mismo que enviaste
        const orderIdFromNotification = params.Ds_Order?.toString();
        if (!orderIdFromNotification) {
            console.error('Ds_Order missing from Redsys notification parameters');
            return NextResponse.json(
                { error: 'Missing Ds_Order from Redsys notification' },
                { status: 400 }
            );
        }

        const calculatedSignature = calculateSignature(secretKeyB64, orderIdFromNotification, paramsB64);

        if (calculatedSignature !== signature) {
            console.warn('❌ Invalid signature received from Redsys. Possible tampering or misconfiguration.', {
                receivedSignature: signature,
                calculatedSignature: calculatedSignature,
                Ds_MerchantParameters: paramsB64,
                Ds_Order: orderIdFromNotification,
                // NO loguear secretKeyB64 en producción
            });
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 403 }
            );
        }

        // Si llegamos aquí, la firma es válida y la notificación es auténtica
        console.log('✅ Redsys notification signature verified for order:', orderIdFromNotification);

        // Actualización del estado de la reserva en Supabase
        const isPaymentSucceeded = params.Ds_Response <= 99; // Códigos de respuesta <= 99 son éxito

        const { error } = await supabase
            .from('reservations')
            .update({
                payment_status: isPaymentSucceeded ? 'succeeded' : 'failed',
                status: isPaymentSucceeded ? 'confirmed' : 'failed',
                ds_response_code: params.Ds_Response,
                ds_authorisation_code: params.Ds_AuthorisationCode || null,
                redsys_notification_received: true,
                redsys_notification_data: params, // Guardar todos los parámetros de la notificación
                paid_amount: parseInt(params.Ds_Amount) / 100, // Redsys envía en céntimos
                paid_at: new Date().toISOString(),
                // Ds_Date viene en formato DD/MM/YYYY, Redsys no envía la hora en este campo
                payment_date: params.Ds_Date ? new Date(params.Ds_Date.split('/').reverse().join('-')).toISOString() : null, // Convertir a formato ISO
                updated_at: new Date().toISOString()
            })
            .eq('id', params.Ds_MerchantData); // Asumiendo que Ds_MerchantData contiene el ID de tu reserva

        if (error) {
            console.error('❌ Error updating reservation in Supabase:', error);
            return NextResponse.json(
                { error: 'Error updating reservation' },
                { status: 500 }
            );
        }

        console.log('✅ Reservation updated successfully in Supabase for order:', orderIdFromNotification);
        // Redsyss espera un 200 OK para confirmar la recepción
        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error('❌ Error processing Redsys notification:', error);
        return NextResponse.json(
            { error: 'Error processing notification', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}