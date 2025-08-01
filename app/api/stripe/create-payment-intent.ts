import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import type { NextApiRequest, NextApiResponse } from 'next';

// Versión exacta que coincide con el tipo esperado
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil' as const,  // Nota el '.basil' al final
  typescript: true
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ 
      code: 'method_not_allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    // Validación robusta del cuerpo de la solicitud
    const { amount, reservationId, currency = 'eur' } = req.body;
    
    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({
        code: 'invalid_amount',
        message: 'Valid amount is required'
      });
    }

    if (!reservationId || typeof reservationId !== 'string') {
      return res.status(400).json({
        code: 'invalid_reservation',
        message: 'Valid reservation ID is required'
      });
    }

    // Crear el Payment Intent con configuración completa
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount)), // Asegura que sea entero
      currency: currency.toLowerCase(),
      metadata: {
        reservation_id: reservationId,
        environment: process.env.NODE_ENV || 'development'
      },
      description: `Reservation #${reservationId}`,
      payment_method_types: ['card'],
      capture_method: 'automatic',
      confirm: false
    });

    // Actualización atómica en Supabase
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        payment_reference: paymentIntent.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_client_secret: paymentIntent.client_secret,
        payment_gateway: 'stripe',
        payment_status: 'requires_payment_method',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Stripe API Error:', error);
    
    // Registro detallado del error
    await supabase.from('payment_errors').insert({
      error_type: 'payment_intent_creation',
      error_data: JSON.stringify({
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        timestamp: new Date().toISOString()
      }),
      severity: 'critical'
    });

    return res.status(500).json({
      code: 'payment_error',
      message: 'Error processing payment',
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : null)
        : undefined
    });
  }
}