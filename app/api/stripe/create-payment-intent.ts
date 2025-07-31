import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import type { NextApiRequest, NextApiResponse } from 'next';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, reservationId, currency = 'eur' } = req.body;

    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        reservation_id: reservationId
      }
    });

    // Actualizar reserva con el ID de Stripe
    await supabase
      .from('reservations')
      .update({ 
        payment_reference: paymentIntent.id 
      })
      .eq('id', reservationId);

    return res.status(200).json({ 
      clientSecret: paymentIntent.client_secret 
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}