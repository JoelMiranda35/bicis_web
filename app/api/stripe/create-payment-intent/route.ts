// app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// ============================================
// 🔒 VALIDACIÓN SERVER-SIDE DE HORARIOS DE TIENDA
// ============================================
// 🔧 FIX: el front (page.tsx) tenía una condición de carrera que podía
// dejar guardado un pickup_time/return_time fuera del horario real de la
// tienda (ej. domingo cerrado, o sábado con cierre a las 14:00 pero
// return_time = 20:00). Esa parte ya se corrigió en el front, pero acá
// agregamos una segunda barrera: el servidor NUNCA debe crear un
// PaymentIntent (es decir, cobrar) si el horario pedido no es válido,
// sin importar qué haya pasado en el navegador del cliente.

type StoreHoursRow = {
  open_time: string | null;
  close_time: string | null;
  split_schedule?: boolean | null;
  open_time_2?: string | null;
  close_time_2?: string | null;
};

/**
 * Genera el set de horas enteras válidas entre open y close (inclusive),
 * igual que `generateHoursBetween` en el front.
 */
function generateHoursBetween(openTime: string | null | undefined, closeTime: string | null | undefined): Set<string> {
  const hours = new Set<string>();
  if (!openTime || !closeTime) return hours;

  const [openHour] = openTime.split(':').map(Number);
  const [closeHour] = closeTime.split(':').map(Number);
  if (!Number.isFinite(openHour) || !Number.isFinite(closeHour) || openHour >= closeHour) {
    return hours;
  }

  for (let hour = openHour; hour <= closeHour; hour++) {
    hours.add(`${String(hour).padStart(2, '0')}:00`);
  }
  return hours;
}

/**
 * Devuelve el set de horas válidas para una tienda y fecha, replicando
 * la misma jerarquía que usa el front (getAvailableTimes en page.tsx):
 * 1) horario especial de esa fecha puntual (store_hours_by_date)
 * 2) horario semanal configurado (store_hours), si no usa el global
 * 3) fallback fijo: 10:00-18:00 de lunes a viernes, 10:00-14:00 sábados,
 *    domingo cerrado.
 */
async function getValidHoursForDate(location: string, dateStr: string): Promise<Set<string>> {
  // dateStr viene como 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return new Set();

  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = domingo, 6 = sábado

  // 1) Horario especial para esa fecha exacta
  const { data: customHours } = await supabase
    .from('store_hours_by_date')
    .select('*')
    .eq('location', location)
    .eq('date', dateStr)
    .maybeSingle<StoreHoursRow>();

  if (customHours) {
    const hours = generateHoursBetween(customHours.open_time, customHours.close_time);
    if (customHours.split_schedule && customHours.open_time_2 && customHours.close_time_2) {
      for (const h of generateHoursBetween(customHours.open_time_2, customHours.close_time_2)) {
        hours.add(h);
      }
    }
    if (hours.size > 0) return hours;
    // Horario especial explícitamente vacío = tienda cerrada ese día
    return hours;
  }

  // 2) Horario semanal configurado (si no usa el global)
  const { data: weeklyHours } = await supabase
    .from('store_hours')
    .select('*')
    .eq('location', location)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle<StoreHoursRow & { use_global?: boolean }>();

  if (weeklyHours && !weeklyHours.use_global) {
    const hours = generateHoursBetween(weeklyHours.open_time, weeklyHours.close_time);
    if (weeklyHours.split_schedule && weeklyHours.open_time_2 && weeklyHours.close_time_2) {
      for (const h of generateHoursBetween(weeklyHours.open_time_2, weeklyHours.close_time_2)) {
        hours.add(h);
      }
    }
    if (hours.size > 0) return hours;
    return hours;
  }

  // 3) Fallback fijo
  if (dayOfWeek === 0) return new Set(); // Domingo cerrado
  if (dayOfWeek === 6) return generateHoursBetween('10:00', '14:00');
  return generateHoursBetween('10:00', '18:00');
}

/**
 * Valida que pickup_time/return_time estén dentro del horario real de la
 * tienda para start_date/end_date. Devuelve null si todo está OK, o un
 * mensaje de error (string) si algo es inválido.
 */
async function validateReservationHours(metadata: Record<string, any>): Promise<string | null> {
  const pickupLocation = metadata?.pickup_location;
  const returnLocation = metadata?.return_location || pickupLocation;
  const startDate = metadata?.start_date;
  const endDate = metadata?.end_date;
  const pickupTime = metadata?.pickup_time;
  const returnTime = metadata?.return_time;

  // Si falta algún dato no podemos validar; dejamos pasar (no bloqueamos
  // reservas legítimas por datos faltantes que ya se validan en otro lado),
  // pero lo dejamos loggeado para poder detectarlo.
  if (!pickupLocation || !startDate || !pickupTime) {
    console.warn('⚠️ validateReservationHours: faltan datos de recogida, se omite validación', {
      pickupLocation, startDate, pickupTime,
    });
    return null;
  }

  const pickupValidHours = await getValidHoursForDate(pickupLocation, startDate);
  if (!pickupValidHours.has(pickupTime)) {
    return `La hora de recogida (${pickupTime}) no está disponible para la fecha ${startDate} en ${pickupLocation}.`;
  }

  if (returnLocation && endDate && returnTime) {
    const returnValidHours = await getValidHoursForDate(returnLocation, endDate);
    if (!returnValidHours.has(returnTime)) {
      return `La hora de devolución (${returnTime}) no está disponible para la fecha ${endDate} en ${returnLocation}.`;
    }
  }

  return null;
}

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

    // 🔒 4. VALIDAR QUE EL HORARIO PEDIDO ESTÉ DENTRO DEL HORARIO DE LA TIENDA
    // Esta es la barrera server-side: si pickup_time/return_time no están
    // dentro del horario real (store_hours_by_date / store_hours / fallback),
    // se rechaza ANTES de crear el PaymentIntent, sin importar qué haya
    // mandado el front.
    if (metadata) {
      const hoursError = await validateReservationHours(metadata);
      if (hoursError) {
        console.warn('🚫 Reserva rechazada por horario inválido:', hoursError, metadata);
        return NextResponse.json(
          { 
            error: hoursError,
            code: 'invalid_store_hours'
          },
          { status: 400 }
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