import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
  typescript: true
});

export async function POST(request: Request) {
  let reservationId: string | undefined;

  try {
    const { amount, reservationId: resId, currency = 'eur', metadata = {} } = await request.json();
    reservationId = resId;

    // Validaciones
    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json(
        { code: 'invalid_amount', message: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!reservationId || typeof reservationId !== 'string') {
      return NextResponse.json(
        { code: 'invalid_reservation', message: 'Valid reservation ID is required' },
        { status: 400 }
      );
    }

    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount)),
      currency: currency.toLowerCase(),
      metadata: {
        reservation_id: reservationId,
        environment: process.env.NODE_ENV || 'development',
        ...metadata
      },
      description: `Reservation #${reservationId}`,
      payment_method_types: ['card'],
      capture_method: 'automatic',
      confirm: false
    });

    // Determinar el estado adecuado para Supabase
    const supabasePaymentStatus = paymentIntent.status === 'requires_payment_method' 
      ? 'pending' 
      : paymentIntent.status;

    // Actualizar Supabase
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        payment_reference: paymentIntent.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_client_secret: paymentIntent.client_secret,
        payment_gateway: 'stripe',
        payment_status: supabasePaymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });

  } catch (error) {
    console.error('Stripe API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase.from('payment_errors').insert({
      error_type: 'payment_intent_creation',
      error_data: JSON.stringify({
        message: errorMessage,
        reservation_id: reservationId || 'unknown',
        timestamp: new Date().toISOString()
      }),
      severity: 'critical'
    });

    return NextResponse.json(
      {
        code: 'payment_error',
        message: 'Error processing payment',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}