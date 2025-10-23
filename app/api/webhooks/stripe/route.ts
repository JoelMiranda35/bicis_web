// app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Tarjetas de prueba a BLOQUEAR
const BLOCKED_TEST_CARDS = ['4242', '4000', '2222', '5556'];

export async function POST(request: Request) {
  try {
    const { amount, currency = 'eur', metadata, payment_method } = await request.json();

    // ✅ BLOQUEO ACTIVADO: Validar si es tarjeta de prueba ANTES de crear el PaymentIntent
    if (payment_method?.card?.last4 && BLOCKED_TEST_CARDS.includes(payment_method.card.last4)) {
      console.log('🚫 BLOQUEO: Tarjeta de prueba detectada:', payment_method.card.last4);
      
      // Registrar intento bloqueado
      await supabase.from('payment_errors').insert({
        error_type: 'test_card_blocked',
        error_data: JSON.stringify({
          card_last4: payment_method.card.last4,
          card_brand: payment_method.card.brand,
          amount,
          customer_email: metadata?.customer_email
        }),
        created_at: new Date().toISOString(),
      });

      return NextResponse.json(
        { 
          error: 'Tarjetas de prueba no permitidas en modo producción',
          code: 'test_card_not_allowed'
        },
        { status: 400 }
      );
    }

    // Validación del amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto total debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Limpieza de metadata
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
      amount,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata: cleanedMetadata,
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Guardar en Supabase
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
      },
      { status: 500 }
    );
  }
}