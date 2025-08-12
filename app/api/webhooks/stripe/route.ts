import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    //console.error('❌ Webhook error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}

// Implementa estas funciones según tu lógica de negocio
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  // Actualizar reserva en Supabase como pagada
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  // Notificar fallo de pago
}

async function handleRefund(charge: Stripe.Charge) {
  // Procesar reembolsos
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // Confirmar reserva
}