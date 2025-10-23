import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  console.log('🔔 Webhook received - BODY:', body.substring(0, 500));
  console.log('🔔 Signature present:', !!signature);

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log('✅ Webhook verified. Event type:', event.type);
    console.log('✅ Event ID:', event.id);
    console.log('✅ Event object:', JSON.stringify(event.data.object, null, 2));

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
      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('💰 Payment succeeded:', paymentIntent.id);
    console.log('📝 Payment metadata:', paymentIntent.metadata);
    // 🚫 BLOQUEAR TARJETAS DE PRUEBA
    const charge = paymentIntent.latest_charge
      ? await stripe.charges.retrieve(paymentIntent.latest_charge as string)
      : null;

    const cardLast4 = charge?.payment_method_details?.card?.last4;
    const cardBrand = charge?.payment_method_details?.card?.brand;

    if (['4242', '4000', '2222', '5556'].includes(cardLast4 || '')) {
      console.warn('🚫 PaymentIntent bloqueado: tarjeta de prueba detectada', {
        id: paymentIntent.id,
        cardBrand,
        cardLast4,
      });

      // Cancelar el PaymentIntent (opcional)
      await stripe.paymentIntents.cancel(paymentIntent.id);

      // Registrar en Supabase como fraude o prueba
      await supabase.from('payment_errors').insert({
        payment_intent_id: paymentIntent.id,
        error_type: 'test_card_in_live_mode',
        error_data: JSON.stringify({ cardBrand, cardLast4 }),
        created_at: new Date().toISOString(),
      });

      return; // ⚠️ Salir sin crear reserva
    }
    
    // Buscar reserva existente por payment_intent_id
    const { data: existingReservation, error: findError } = await supabase
      .from('reservations')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding reservation:', findError);
    }

    if (existingReservation) {
      // Actualizar reserva existente
      const { data: updatedReservation, error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          paid_amount: paymentIntent.amount / 100,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating reservation:', updateError);
      } else {
        console.log('✅ Reservation updated:', updatedReservation.id);
        
        // Enviar email de confirmación
        await sendConfirmationEmail(updatedReservation);
      }
    } else {
      // Crear nueva reserva desde metadata
      await createReservationFromMetadata(paymentIntent);
    }
  } catch (error) {
    console.error('Error in handlePaymentSuccess:', error);
  }
}

async function createReservationFromMetadata(paymentIntent: Stripe.PaymentIntent) {
  try {
    const metadata = paymentIntent.metadata;
    
    console.log('📦 Creating reservation from metadata:', metadata);

    // ✅ SOLUCIÓN: Validar pickup_location en el webhook también
    const validatedPickupLocation = 
      metadata.pickup_location && ['sucursal_altea', 'sucursal_albir'].includes(metadata.pickup_location)
        ? metadata.pickup_location
        : 'sucursal_altea';

    // Parsear datos de bicicletas
    let bikesData = [];
    try {
      bikesData = JSON.parse(metadata.bikes_data || '[]');
    } catch (e) {
      console.error('Error parsing bikes data:', e);
    }

    // Parsear datos de accesorios
    let accessoriesData = [];
    try {
      accessoriesData = JSON.parse(metadata.accessories_data || '[]');
    } catch (e) {
      console.error('Error parsing accessories data:', e);
    }

    const reservationData = {
      customer_name: metadata.customer_name || '',
      customer_email: metadata.customer_email || '',
      customer_phone: metadata.customer_phone || '',
      customer_dni: metadata.customer_dni || '',
      start_date: metadata.start_date || new Date().toISOString(),
      end_date: metadata.end_date || new Date().toISOString(),
      pickup_time: metadata.pickup_time || '10:00',
      return_time: metadata.return_time || '18:00',
      pickup_location: validatedPickupLocation, // ✅ USAR VARIABLE VALIDADA
      return_location: validatedPickupLocation, // ✅ USAR VARIABLE VALIDADA
      total_days: parseInt(metadata.total_days || '1'),
      bikes: bikesData,
      accessories: accessoriesData,
      insurance: metadata.insurance === 'true',
      total_amount: parseFloat(metadata.total_amount || '0'),
      deposit_amount: parseFloat(metadata.deposit_amount || '0'),
      paid_amount: paymentIntent.amount / 100,
      status: 'confirmed',
      payment_status: 'paid',
      stripe_payment_intent_id: paymentIntent.id,
      payment_gateway: 'stripe',
      locale: metadata.locale || 'es',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select()
      .single();

    if (error) {
      console.error('Error creating reservation:', error);
      throw error;
    }

    console.log('✅ Reservation created from metadata:', data.id);
    
    // Enviar email de confirmación
    await sendConfirmationEmail(data);
    
  } catch (error) {
    console.error('Error creating reservation from metadata:', error);
    
    // Guardar error en base de datos para debugging
    await supabase
      .from('payment_errors')
      .insert({
        payment_intent_id: paymentIntent.id,
        error_type: 'reservation_creation_failed',
        error_data: JSON.stringify({
          metadata: paymentIntent.metadata,
          error: error instanceof Error ? error.message : String(error)
        }),
        created_at: new Date().toISOString()
      });
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('❌ Payment failed:', paymentIntent.id);
    
    // Actualizar reserva como fallida
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        payment_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);

    if (error) {
      console.error('Error updating failed reservation:', error);
    } else {
      console.log('✅ Reservation marked as failed:', paymentIntent.id);
    }

    // Opcional: Enviar email de fallo de pago
    // await sendPaymentFailedEmail(paymentIntent);

  } catch (error) {
    console.error('Error in handlePaymentFailure:', error);
  }
}

async function handleRefund(charge: Stripe.Charge) {
  try {
    console.log('💸 Refund processed:', charge.id);
    
    const paymentIntentId = charge.payment_intent as string;
    
    // Actualizar reserva como reembolsada
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        payment_status: 'refunded',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntentId);

    if (error) {
      console.error('Error updating refunded reservation:', error);
    } else {
      console.log('✅ Reservation marked as refunded:', paymentIntentId);
    }

  } catch (error) {
    console.error('Error in handleRefund:', error);
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  try {
    console.log('🛒 Checkout session completed:', session.id);
    console.log('📝 Session metadata:', session.metadata);
    
    // Este evento es útil si usas Checkout Sessions en lugar de Payment Intents directos
    // Por ahora lo dejamos como backup
    
    if (session.payment_intent) {
      console.log('🔗 Checkout session linked to payment intent:', session.payment_intent);
      
      // Podemos recuperar el payment intent para procesarlo
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent as string
      );
      
      if (paymentIntent.status === 'succeeded') {
        await handlePaymentSuccess(paymentIntent);
      }
    }

  } catch (error) {
    console.error('Error in handleCheckoutComplete:', error);
  }
}

async function sendConfirmationEmail(reservation: any) {
  try {
    console.log('📧 Sending confirmation email for reservation:', reservation.id);
    
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: reservation.customer_email,
        subject: 'Reserva Confirmada - Altea Bike Shop',
        reservationData: reservation,
        language: reservation.locale || 'es',
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API responded with status: ${response.status}`);
    }

    console.log('✅ Confirmation email sent to:', reservation.customer_email);
    
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    
    // Guardar error de email pero no fallar el proceso completo
    await supabase
      .from('email_errors')
      .insert({
        reservation_id: reservation.id,
        error_type: 'confirmation_email_failed',
        error_data: JSON.stringify({
          customer: reservation.customer_email,
          error: error instanceof Error ? error.message : String(error)
        }),
        created_at: new Date().toISOString()
      });
  }
}