// app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

// Verifica que la clave de Stripe esté configurada
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

// Inicializar Stripe correctamente
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);


export async function POST(request: Request) {
  try {
    const { amount, currency = 'eur', metadata } = await request.json();

    // Validación más robusta del amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amount);
    if (amountInCents <= 0) {
      return NextResponse.json(
        { error: 'El monto total debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Validación y limpieza de metadata
    const cleanedMetadata: Record<string, string> = {};
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined && value !== null) {
          cleanedMetadata[key] = String(value).substring(0, 500);
        } else {
          cleanedMetadata[key] = '';
        }
      }
    }

    // Crear PaymentIntent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata: cleanedMetadata,
    };

    if (cleanedMetadata.customer_phone) {
      paymentIntentParams.shipping = {
        name: cleanedMetadata.customer_name || '',
        phone: cleanedMetadata.customer_phone,
        address: {
          line1: cleanedMetadata.customer_address || 'Not provided',
          city: cleanedMetadata.customer_city || 'Not provided',
          country: cleanedMetadata.customer_country || 'ES',
        },
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Intentar guardar en Supabase (pero continuar si falla)
    try {
      const { error } = await supabase.from('payment_intents').insert({
        intent_id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customer_email: cleanedMetadata.customer_email || '',
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
      });

      if (error) {
        console.error('Supabase insert error:', error);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { 
        error: 'Error al procesar el pago',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
