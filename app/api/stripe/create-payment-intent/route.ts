import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
  typescript: true
});

export async function POST(request: Request) {
  try {
    const { 
      amount, 
      currency = 'eur', 
      metadata 
    } = await request.json();

    // Validaciones completas
    if (!amount || isNaN(Number(amount)) || Number(amount) < 50) {
      return NextResponse.json(
        { 
          code: 'invalid_amount', 
          message: 'Amount must be at least 0.50€' 
        },
        { status: 400 }
      );
    }

    // Validar estructura de metadata
    const requiredMetadataFields = [
      'customer_name',
      'customer_email',
      'start_date',
      'end_date',
      'bikes'
    ];

    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json(
        { 
          code: 'invalid_metadata', 
          message: 'Metadata must be an object with reservation details' 
        },
        { status: 400 }
      );
    }

    // Verificar campos obligatorios
    for (const field of requiredMetadataFields) {
      if (!metadata[field]) {
        return NextResponse.json(
          { 
            code: 'missing_field', 
            message: `Metadata is missing required field: ${field}` 
          },
          { status: 400 }
        );
      }
    }

    // Crear Payment Intent con todos los metadatos necesarios
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount)),
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        environment: process.env.NODE_ENV || 'development',
        created_at: new Date().toISOString(),
        app_version: '1.0.0'
      },
      description: `Bike rental for ${metadata.customer_name}`,
      payment_method_types: ['card'],
      capture_method: 'automatic',
      shipping: {
        name: metadata.customer_name,
        address: {
          country: 'ES'
        }
      }
    });

    // Registrar en Supabase para seguimiento
    await supabase.from('payment_intents').insert({
      intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer_email: metadata.customer_email,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    });

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
    const errorCode = error instanceof Stripe.errors.StripeError ? error.code : 'server_error';

    // Registrar error en Supabase
    await supabase.from('payment_errors').insert({
      error_type: 'payment_intent_creation',
      error_code: errorCode,
      error_data: JSON.stringify({
        message: errorMessage,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : null
      }),
      severity: 'critical'
    });

    return NextResponse.json(
      {
        code: errorCode,
        message: 'Error processing payment',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}