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
    
    // 🔍 REGISTRAR LOG PARA SEGUIMIENTO
    await supabase.from('payment_logs').insert({
      payment_intent_id: paymentIntent.id,
      event_type: 'payment_intent.succeeded',
      metadata: paymentIntent.metadata,
      created_at: new Date().toISOString(),
    });
    
    // 🚨 BLOQUEAR TARJETAS DE PRUEBA
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

      await stripe.paymentIntents.cancel(paymentIntent.id);

      await supabase.from('payment_errors').insert({
        payment_intent_id: paymentIntent.id,
        error_type: 'test_card_in_live_mode',
        error_data: JSON.stringify({ cardBrand, cardLast4 }),
        created_at: new Date().toISOString(),
      });

      return;
    }
    
    // 🔴🚨 **MEJORAS EN IDEMPOTENCIA** 🚨🔴
    
    // 1. VERIFICAR SI RESERVA YA EXISTE POR PAYMENT_INTENT_ID
    const { data: existingReservation } = await supabase
      .from('reservations')
      .select('id, status, customer_email')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (existingReservation) {
      console.log('✅ Webhook: Reserva ya existe, actualizando estado:', existingReservation.id);
      
      // Solo actualizar si no está ya confirmada
      if (existingReservation.status !== 'confirmed') {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            paid_amount: paymentIntent.amount / 100,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.error('Error updating reservation:', updateError);
        }
      }
      
      // 🔍 REGISTRAR DUPLICADO DETECTADO
      await supabase.from('payment_logs').insert({
        payment_intent_id: paymentIntent.id,
        event_type: 'duplicate_payment_detected',
        metadata: { existing_reservation_id: existingReservation.id },
        created_at: new Date().toISOString(),
      });
      
      return;
    }

    // 2. VERIFICAR SI HAY RESERVA DUPLICADA POR DATOS ÚNICOS
    if (paymentIntent.metadata?.customer_email && paymentIntent.metadata?.start_date) {
      const { data: duplicateReservation } = await supabase
        .from('reservations')
        .select('id, status, stripe_payment_intent_id')
        .eq('customer_email', paymentIntent.metadata.customer_email)
        .eq('start_date', `${paymentIntent.metadata.start_date}T00:00:00.000Z`)
        .eq('end_date', `${paymentIntent.metadata.end_date}T00:00:00.000Z`)
        .eq('pickup_time', paymentIntent.metadata.pickup_time)
        .in('status', ['confirmed', 'pending'])
        .maybeSingle();

      if (duplicateReservation) {
        console.log('🔄 Webhook: Reserva duplicada detectada por fechas/email:', duplicateReservation.id);
        
        // Actualizar con el payment_intent_id correcto
        await supabase
          .from('reservations')
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            payment_status: 'paid',
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', duplicateReservation.id);
        
        // 🔍 REGISTRAR DUPLICADO POR DATOS
        await supabase.from('payment_logs').insert({
          payment_intent_id: paymentIntent.id,
          event_type: 'duplicate_reservation_by_data',
          metadata: { duplicate_reservation_id: duplicateReservation.id },
          created_at: new Date().toISOString(),
        });
        
        return;
      }
    }

    // 3. VERIFICAR RESERVAS RECIENTES DEL MISMO CLIENTE (10 minutos)
    if (paymentIntent.metadata?.customer_email) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();
      
      const { data: recentReservations } = await supabase
        .from('reservations')
        .select('id, created_at')
        .eq('customer_email', paymentIntent.metadata.customer_email)
        .eq('status', 'confirmed')
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(2);
      
      if (recentReservations && recentReservations.length > 1) {
        console.log('🚨 Múltiples reservas recientes detectadas:', recentReservations.length);
        
        // Marcar como potencial fraude
        await supabase.from('payment_alerts').insert({
          alert_type: 'multiple_recent_reservations',
          customer_email: paymentIntent.metadata.customer_email,
          payment_intent_id: paymentIntent.id,
          reservation_count: recentReservations.length,
          created_at: new Date().toISOString()
        });
      }
    }

    // 4. SOLO SI NO EXISTE NINGUNA RESERVA → CREAR UNA NUEVA
    console.log('🆕 Webhook: Creando nueva reserva desde metadata');
    await createReservationFromMetadata(paymentIntent);
    
  } catch (error) {
    console.error('Error in handlePaymentSuccess:', error);
    
    // Guardar error
    await supabase
      .from('payment_errors')
      .insert({
        payment_intent_id: paymentIntent.id,
        error_type: 'handlePaymentSuccess_error',
        error_data: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }),
        created_at: new Date().toISOString()
      });
  }
}

async function createReservationFromMetadata(paymentIntent: Stripe.PaymentIntent) {
  try {
    const metadata = paymentIntent.metadata;
    
    console.log('📦 Creating reservation from metadata:', metadata);
    console.log('📍 pickup_location from metadata:', metadata.pickup_location);

    // ========================================
    // 🔴 FIX #1: VALIDACIÓN DE DOMINGOS
    // ========================================
    
    const startDate = new Date(metadata.start_date + 'T00:00:00.000Z');
    const endDate = new Date(metadata.end_date + 'T00:00:00.000Z');
    
    const startDay = startDate.getUTCDay();
    const endDay = endDate.getUTCDay();
    
    if (startDay === 0 || endDay === 0) {
      console.error('❌ WEBHOOK: Fecha en domingo detectada', {
        start_date: metadata.start_date,
        end_date: metadata.end_date,
        startDay,
        endDay
      });
      
      // HACER REFUND AUTOMÁTICO
      try {
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'Sunday booking not allowed - Store closed on Sundays'
          }
        });
        
        console.log('✅ Refund creado por reserva en domingo');
        
        // Registrar refund
        await supabase.from('payment_logs').insert({
          payment_intent_id: paymentIntent.id,
          event_type: 'refund_sunday_booking',
          metadata: {
            start_date: metadata.start_date,
            end_date: metadata.end_date,
            customer_email: metadata.customer_email
          },
          created_at: new Date().toISOString(),
        });
        
        // Enviar email al cliente explicando
        await sendRefundEmail(metadata.customer_email, {
          reason: 'Tu reserva fue rechazada porque seleccionaste un domingo para recogida o devolución. Nuestra tienda está cerrada los domingos. Se ha procesado un reembolso automático.',
          amount: paymentIntent.amount / 100,
          refund_id: paymentIntent.id
        });
        
      } catch (refundError) {
        console.error('❌ Error creating refund for Sunday booking:', refundError);
      }
      
      return; // NO crear reserva
    }
    
    console.log('✅ WEBHOOK: Validación de domingos OK');

    // ========================================
    // 🔴 FIX #2: USAR selected_bike_ids GARANTIZADO
    // ========================================
    
    const selectedBikeIds = metadata.selected_bike_ids 
      ? metadata.selected_bike_ids.split(',').filter(Boolean).map(id => id.trim())
      : [];

    // VALIDACIÓN CRÍTICA
    if (selectedBikeIds.length === 0) {
      console.error('❌ WEBHOOK: No hay bike_ids en metadata');
      
      // REFUND + ALERTA
      try {
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'No bike IDs found in payment metadata'
          }
        });
        
        console.log('✅ Refund creado por falta de bike_ids');
        
        // Alerta al admin
        await supabase.from('admin_alerts').insert({
          alert_type: 'WEBHOOK_NO_BIKE_IDS',
          payment_intent_id: paymentIntent.id,
          customer_email: metadata.customer_email,
          details: 'Payment succeeded but no bike_ids in metadata',
          created_at: new Date().toISOString()
        });
        
        // Email al cliente
        await sendRefundEmail(metadata.customer_email, {
          reason: 'Hubo un error técnico al procesar tu reserva (falta información de bicicletas). Se ha procesado un reembolso automático. Por favor, contacta con nosotros.',
          amount: paymentIntent.amount / 100,
          refund_id: paymentIntent.id
        });
        
      } catch (refundError) {
        console.error('❌ Error creating refund for missing bike_ids:', refundError);
      }
      
      return;
    }

    console.log('✅ WEBHOOK: bike_ids encontrados:', selectedBikeIds.length, selectedBikeIds);

    // ========================================
    // 🔴 FIX #3: PARSEAR bikes_data SEGURO
    // ========================================
    
    let bikesData = [];
    try {
      if (metadata.bikes_data) {
        bikesData = JSON.parse(metadata.bikes_data);
        console.log('✅ bikes_data parseado:', bikesData.length, 'grupos');
      }
    } catch (error) {
      console.warn('⚠️ WEBHOOK: Error parseando bikes_data, usando IDs directamente:', error);
      // Continuar usando selectedBikeIds
    }

    // ========================================
    // 🔴 FIX #4: RECONSTRUIR ESTRUCTURA CON IDS GARANTIZADOS
    // ========================================
    
    const bikesToSave = bikesData.map((bike: any, index: number) => {
      // Calcular qué IDs pertenecen a este grupo
      const previousQuantity = bikesData.slice(0, index).reduce((sum: number, b: any) => 
        sum + (b.qty || b.quantity || 0), 0);
      const thisQuantity = bike.qty || bike.quantity || 1;
      const bikeIdsForThisGroup = selectedBikeIds.slice(previousQuantity, previousQuantity + thisQuantity);
      
      return {
        model: bike.model || "Sin modelo",
        size: bike.size || "N/A",
        quantity: thisQuantity,
        category: bike.cat || bike.category || "ROAD",
        bike_ids: bikeIdsForThisGroup  // 🔴 IDs desde metadata garantizado
      };
    });

    // Si bikesData está vacío, crear estructura básica
    if (bikesToSave.length === 0) {
      console.warn('⚠️ bikes_data vacío, creando estructura básica');
      bikesToSave.push({
        model: "Bicicleta",
        size: "N/A",
        quantity: selectedBikeIds.length,
        category: "ROAD",
        bike_ids: selectedBikeIds
      });
    }

    // ========================================
    // 🔴 FIX #5: VERIFICAR ESTRUCTURA FINAL
    // ========================================
    
    const finalBikeIds: string[] = [];
    bikesToSave.forEach((bike: any) => {
      if (bike.bike_ids && Array.isArray(bike.bike_ids)) {
        finalBikeIds.push(...bike.bike_ids);
      }
    });

    if (finalBikeIds.length === 0) {
      console.error('❌ WEBHOOK: bikesToSave sin IDs después de reconstrucción');
      
      // REFUND + ALERTA
      try {
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
          metadata: {
            reason: 'Failed to reconstruct bike IDs'
          }
        });
        
        await supabase.from('admin_alerts').insert({
          alert_type: 'WEBHOOK_RECONSTRUCTION_FAILED',
          payment_intent_id: paymentIntent.id,
          customer_email: metadata.customer_email,
          details: JSON.stringify({ bikesData, selectedBikeIds }),
          created_at: new Date().toISOString()
        });
        
      } catch (refundError) {
        console.error('❌ Error creating refund:', refundError);
      }
      
      return;
    }

    console.log('✅ WEBHOOK: Estructura final verificada:', {
      grupos_de_bicis: bikesToSave.length,
      total_bike_ids: finalBikeIds.length,
      bike_ids: finalBikeIds
    });

    // ========================================
    // 🔴 FIX #6: RE-VERIFICAR DISPONIBILIDAD
    // ========================================
    
    console.log('🔍 WEBHOOK: Verificando disponibilidad final...');
    
    const { data: overlappingReservations } = await supabase
      .from('reservations')
      .select('bikes, start_date, end_date, pickup_time, return_time, status, id')
      .in('status', ['confirmed', 'in_process']);

    let hasConflict = false;
    const conflictingBikes: string[] = [];

    if (overlappingReservations && overlappingReservations.length > 0) {
      overlappingReservations.forEach((reservation: any) => {
        try {
          const resStart = new Date(reservation.start_date);
          const resEnd = new Date(reservation.end_date);
          const selStart = new Date(metadata.start_date);
          const selEnd = new Date(metadata.end_date);

          // Verificar solapamiento
          const overlaps = selStart < resEnd && selEnd > resStart;

          if (overlaps) {
            const reservedBikeIds: string[] = [];
            const resBikes = typeof reservation.bikes === 'string' 
              ? JSON.parse(reservation.bikes) 
              : reservation.bikes;
            
            if (Array.isArray(resBikes)) {
              resBikes.forEach((bikeGroup: any) => {
                if (bikeGroup.bike_ids && Array.isArray(bikeGroup.bike_ids)) {
                  reservedBikeIds.push(...bikeGroup.bike_ids.map((id: string) => id.trim()));
                }
              });
            }

            const duplicates = finalBikeIds.filter(id => reservedBikeIds.includes(id));
            if (duplicates.length > 0) {
              hasConflict = true;
              conflictingBikes.push(...duplicates);
              console.error('🚨 WEBHOOK: Conflicto detectado con reserva', reservation.id, duplicates);
            }
          }
        } catch (error) {
          console.error('Error checking reservation conflict:', error);
        }
      });
    }

    if (hasConflict) {
      const uniqueConflicts = [...new Set(conflictingBikes)];
      console.error('❌ WEBHOOK: CONFLICTO - Bicis no disponibles:', uniqueConflicts);
      
      // REFUND AUTOMÁTICO
      try {
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
          metadata: {
            reason: `Bikes no longer available: ${uniqueConflicts.join(', ')}`
          }
        });
        
        console.log('✅ Refund creado por conflicto de disponibilidad');
        
        await supabase.from('payment_logs').insert({
          payment_intent_id: paymentIntent.id,
          event_type: 'refund_bike_conflict',
          metadata: {
            conflicting_bikes: uniqueConflicts,
            customer_email: metadata.customer_email
          },
          created_at: new Date().toISOString(),
        });
        
        // Email al cliente
        await sendRefundEmail(metadata.customer_email, {
          reason: `Lo sentimos, las siguientes bicicletas ya no están disponibles para las fechas seleccionadas: ${uniqueConflicts.join(', ')}. Se ha procesado un reembolso automático.`,
          amount: paymentIntent.amount / 100,
          refund_id: paymentIntent.id
        });
        
      } catch (refundError) {
        console.error('❌ Error creating refund for bike conflict:', refundError);
      }
      
      return;
    }

    console.log('✅ WEBHOOK: Verificación de disponibilidad OK');

    // ========================================
    // 🔴 FIX #7: PARSEAR ACCESSORIES SEGURO
    // ========================================
    
    let accessoriesData = [];
    try {
      if (metadata.accessories_data) {
        accessoriesData = JSON.parse(metadata.accessories_data);
      }
    } catch (error) {
      console.warn('⚠️ Error parseando accessories_data:', error);
      accessoriesData = [];
    }

    // ========================================
    // VALIDAR Y PREPARAR pickup_location
    // ========================================
    
    const validPickupLocations = ['sucursal_altea', 'sucursal_albir'];
    const validatedPickupLocation = validPickupLocations.includes(metadata.pickup_location)
      ? metadata.pickup_location
      : 'sucursal_altea';

    if (metadata.pickup_location && !validPickupLocations.includes(metadata.pickup_location)) {
      console.warn(`⚠️ pickup_location inválido recibido: ${metadata.pickup_location}, usando: ${validatedPickupLocation}`);
    }

    // ========================================
    // 🔴 FIX #8: INSERTAR EN BD
    // ========================================
    
    const reservationData = {
      customer_name: metadata.customer_name || '',
      customer_email: metadata.customer_email || '',
      customer_phone: metadata.customer_phone || '',
      customer_dni: metadata.customer_dni || '',
      start_date: `${metadata.start_date}T00:00:00.000Z`,
      end_date: `${metadata.end_date}T00:00:00.000Z`,
      pickup_time: metadata.pickup_time || '10:00',
      return_time: metadata.return_time || '18:00',
      pickup_location: validatedPickupLocation,
      return_location: validatedPickupLocation,
      total_days: parseInt(metadata.total_days || '1'),
      bikes: bikesToSave,  // 🔴 Estructura corregida
      accessories: accessoriesData,
      insurance: metadata.insurance === '1',
      total_amount: parseFloat(metadata.total_amount?.toString().replace(',', '.') || '0'),
      deposit_amount: parseFloat(metadata.deposit_amount?.toString().replace(',', '.') || '0'),
      paid_amount: paymentIntent.amount / 100,
      status: 'confirmed',
      payment_status: 'paid',
      stripe_payment_intent_id: paymentIntent.id,
      payment_gateway: 'stripe',
      locale: metadata.locale || 'es',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('💾 WEBHOOK: Guardando en BD...', {
      bikes_count: bikesToSave.length,
      total_bike_ids: finalBikeIds.length
    });

    // 🔥 USAR UPSERT para aprovechar índice único
    const { data, error } = await supabase
      .from('reservations')
      .upsert([reservationData], {
        onConflict: 'stripe_payment_intent_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      // Si es error de duplicado, es NORMAL
      if (error.code === '23505') {
        console.log('🔄 Reserva duplicada detectada por BD (índice único):', paymentIntent.id);
        
        const { data: existingReservation } = await supabase
          .from('reservations')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single();
          
        console.log('📋 Reserva existente recuperada:', existingReservation?.id);
        return existingReservation;
      }
      
      console.error('❌ Error upserting reservation:', error);
      throw error;
    }

    console.log('✅ Reservation created/updated:', data.id);

    // ========================================
    // 🔴 FIX #9: VERIFICACIÓN POST-INSERCIÓN
    // ========================================
    
    const savedBikes = data.bikes;
    const savedBikeIds: string[] = [];
    
    if (Array.isArray(savedBikes)) {
      savedBikes.forEach((bike: any) => {
        if (bike.bike_ids && Array.isArray(bike.bike_ids)) {
          savedBikeIds.push(...bike.bike_ids);
        }
      });
    }

    console.log('✅ WEBHOOK: Bicis guardadas en BD:', {
      total: savedBikeIds.length,
      ids: savedBikeIds.join(', ')
    });

    // 🚨 ALERTA SI NO HAY IDs GUARDADOS
    if (savedBikeIds.length === 0) {
      console.error('🚨🚨🚨 CRÍTICO: Reserva creada SIN bike_ids');
      
      await supabase.from('admin_alerts').insert({
        alert_type: 'RESERVATION_WITHOUT_BIKES',
        reservation_id: data.id,
        payment_intent_id: paymentIntent.id,
        customer_email: metadata.customer_email,
        details: 'Reserva creada desde webhook sin bike_ids',
        created_at: new Date().toISOString()
      });
    } else if (savedBikeIds.length !== selectedBikeIds.length) {
      console.warn('⚠️ ADVERTENCIA: IDs guardados ≠ IDs seleccionados', {
        seleccionados: selectedBikeIds.length,
        guardados: savedBikeIds.length
      });
      
      await supabase.from('admin_alerts').insert({
        alert_type: 'BIKE_IDS_MISMATCH',
        reservation_id: data.id,
        payment_intent_id: paymentIntent.id,
        details: JSON.stringify({ selectedBikeIds, savedBikeIds }),
        created_at: new Date().toISOString()
      });
    }
    
    // 🔍 REGISTRAR RESERVA CREADA/ACTUALIZADA
    await supabase.from('payment_logs').insert({
      payment_intent_id: paymentIntent.id,
      event_type: 'reservation_created_or_updated',
      metadata: { 
        reservation_id: data.id,
        bike_ids_count: savedBikeIds.length,
        action: data.created_at === data.updated_at ? 'created' : 'updated'
      },
      created_at: new Date().toISOString(),
    });
    
    // Enviar email de confirmación SOLO si es nueva
    const isNewReservation = data.created_at === data.updated_at;
    if (isNewReservation) {
      console.log('📧 Enviando email de confirmación para nueva reserva:', data.id);
      await sendConfirmationEmail(data);
    } else {
      console.log('🔄 Reserva actualizada, no se envía email:', data.id);
    }
    
    return data;
    
  } catch (error) {
    console.error('Error creating reservation from metadata:', error);
    
    // Guardar error en base de datos
    await supabase
      .from('payment_errors')
      .insert({
        payment_intent_id: paymentIntent.id,
        error_type: 'reservation_creation_failed',
        error_data: JSON.stringify({
          metadata: paymentIntent.metadata,
          error: error instanceof Error ? error.message : String(error),
          code: error instanceof Error ? (error as any).code : undefined
        }),
        created_at: new Date().toISOString()
      });
      
    throw error;
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('❌ Payment failed:', paymentIntent.id);
    
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

  } catch (error) {
    console.error('Error in handlePaymentFailure:', error);
  }
}

async function handleRefund(charge: Stripe.Charge) {
  try {
    console.log('💸 Refund processed:', charge.id);
    
    const paymentIntentId = charge.payment_intent as string;
    
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
    
    if (session.payment_intent) {
      console.log('🔗 Checkout session linked to payment intent:', session.payment_intent);
      
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

async function sendRefundEmail(email: string, refundInfo: { reason: string; amount: number; refund_id: string }) {
  try {
    console.log('📧 Sending refund email to:', email);
    
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: 'Reembolso Procesado - Altea Bike Shop',
        type: 'refund',
        refundData: {
          reason: refundInfo.reason,
          amount: refundInfo.amount,
          refund_id: refundInfo.refund_id
        },
        language: 'es',
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API responded with status: ${response.status}`);
    }

    console.log('✅ Refund email sent to:', email);
    
  } catch (error) {
    console.error('Error sending refund email:', error);
    
    await supabase
      .from('email_errors')
      .insert({
        error_type: 'refund_email_failed',
        error_data: JSON.stringify({
          customer: email,
          error: error instanceof Error ? error.message : String(error),
          refund_info: refundInfo
        }),
        created_at: new Date().toISOString()
      });
  }
}
