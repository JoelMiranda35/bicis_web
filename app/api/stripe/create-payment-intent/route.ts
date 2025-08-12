import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    typescript: true
});

export async function POST(request: Request) {
    try {
        const { amount, currency = 'eur', metadata } = await request.json();

        // Validar amount (debe ser > 0)
        const amountInCents = Math.round(Number(amount));
        if (isNaN(amountInCents) || amountInCents <= 0) {
            return NextResponse.json(
                { error: 'El monto total debe ser mayor a 0' },
                { status: 400 }
            );
        }

        // Validar y limpiar metadata
        const cleanedMetadata: Record<string, string> = {};
        if (metadata && typeof metadata === 'object') {
            for (const [key, value] of Object.entries(metadata)) {
                if (value === undefined || value === null) {
                    cleanedMetadata[key] = '';
                } else {
                    // Convertir a string y limitar a 500 caracteres
                    cleanedMetadata[key] = String(value).substring(0, 500);
                }
            }
        }

        // Crear PaymentIntent en Stripe
        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
            amount: amountInCents,
            currency: currency.toLowerCase(),
            payment_method_types: ['card'],
            metadata: cleanedMetadata
        };

        // Opcional: añadir shipping info si hay teléfono
        if (cleanedMetadata.customer_phone) {
            paymentIntentParams.shipping = {
                name: cleanedMetadata.customer_name || '',
                phone: cleanedMetadata.customer_phone,
                address: {
                    line1: 'Not provided',
                    city: 'Not provided',
                    country: 'ES'
                }
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        // Guardar en Supabase (opcional, puedes omitir si falla)
        try {
            await supabase.from('payment_intents').insert({
                intent_id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                customer_email: cleanedMetadata.customer_email || '',
                status: paymentIntent.status,
                metadata: paymentIntent.metadata
            });
        } catch (dbError) {
            //console.error("Error al guardar en Supabase:", dbError);
            // Continuar aunque falle Supabase
        }

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (error) {
        //console.error("Error en /create-payment-intent:", error);
        return NextResponse.json(
            { 
                error: 'Error al procesar el pago',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}