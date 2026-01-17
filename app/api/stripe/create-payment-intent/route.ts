// app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(request: Request) {
  try {
    const { amount, currency = 'eur', metadata, idempotencyKey } = await request.json();
    
    // ✅ 1. EXTRAER IDEMPOTENCY KEY
    const requestIdempotencyKey = request.headers.get('X-Idempotency-Key') || idempotencyKey;
    
    if (!requestIdempotencyKey) {
      return NextResponse.json(
        { error: 'Idempotency key requerida' },
        { status: 400 }
      );
    }

    // 🚨 2. VERIFICAR SI YA EXISTE PAYMENTINTENT CON ESTA KEY
    if (requestIdempotencyKey) {
      const { data: existingIntent } = await supabase
        .from('payment_intents')
        .select('intent_id, status, created_at')
        .eq('idempotency_key', requestIdempotencyKey)
        .maybeSingle();
      
      if (existingIntent) {
        console.log('🔄 PaymentIntent ya existe:', existingIntent.intent_id);
        
        // Verificar si ya hay reserva para este PaymentIntent
        const { data: existingReservation } = await supabase
          .from('reservations')
          .select('id, status')
          .eq('stripe_payment_intent_id', existingIntent.intent_id)
          .maybeSingle();
        
        if (existingReservation) {
          return NextResponse.json(
            { 
              error: 'Ya tienes una reserva confirmada.',
              reservationId: existingReservation.id,
              code: 'reservation_exists'
            },
            { status: 409 }
          );
        }
        
        // Recuperar de Stripe para ver estado actual
        try {
          const stripePaymentIntent = await stripe.paymentIntents.retrieve(existingIntent.intent_id);
          
          if (stripePaymentIntent.status === 'requires_payment_method') {
            console.log('🔄 Reutilizando PaymentIntent existente');
            
            return NextResponse.json({
              clientSecret: stripePaymentIntent.client_secret,
              paymentIntentId: stripePaymentIntent.id,
              alreadyExists: true
            });
          }
        } catch (error) {
          console.error('Error recuperando PaymentIntent:', error);
        }
      }
    }

    // 🚨 3. VERIFICAR RESERVAS DUPLICADAS POR DATOS
    if (metadata && metadata.customer_email && metadata.start_date) {
      const { data: duplicateReservation } = await supabase
        .from('reservations')
        .select('id, status')
        .eq('customer_email', metadata.customer_email)
        .eq('start_date', `${metadata.start_date} 00:00:00+00`)
        .eq('pickup_time', metadata.pickup_time)
        .in('status', ['confirmed', 'pending'])
        .maybeSingle();
      
      if (duplicateReservation) {
        return NextResponse.json(
          { 
            error: 'Ya tienes una reserva para estas fechas.',
            code: 'duplicate_reservation'
          },
          { status: 409 }
        );
      }
    }

    // Validación del amount
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Monto inválido' },
        { status: 400 }
      );
    }

    // Limpiar metadata
    const cleanedMetadata: Record<string, string> = {};
    if (metadata && typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined && value !== null) {
          cleanedMetadata[key] = String(value).substring(0, 500);
        }
      }
    }

    // Agregar idempotency key
    cleanedMetadata.idempotency_key = requestIdempotencyKey;

    // Crear PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata: cleanedMetadata,
    }, {
      idempotencyKey: requestIdempotencyKey
    });

    // Guardar en payment_intents
    await supabase.from('payment_intents').insert({
      intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer_email: cleanedMetadata.customer_email || '',
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
      idempotency_key: requestIdempotencyKey,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error: any) {
    console.error('Stripe error:', error);
    
    return NextResponse.json(
      { 
        error: 'Error al procesar el pago',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}