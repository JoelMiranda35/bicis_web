import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export const dynamic = 'force-dynamic';

interface BikeItem {
  id: string;
  size: string;
  quantity: number;
}

interface AccessoryItem {
  id: string;
  quantity?: number;
}

interface ReservationData {
  customer_name: string;
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  bikes: BikeItem[];
  accessories: AccessoryItem[];
  insurance: boolean;
  total_amount: number;
  deposit_amount: number;
  locale: string;
}

interface BikeData {
  id: string;
  title_es?: string;
  title_en?: string;
  title_nl?: string;
  size?: string;
}

interface AccessoryData {
  id: string;
  name_es?: string;
  name_en?: string;
  name_nl?: string;
}

const translations = {
  es: {
    subject: "Confirmación de Reserva - Altea Bike Shop",
    greeting: "¡Hola",
    confirmed: "Tu reserva ha sido confirmada con éxito!",
    details: "Detalles de la reserva:",
    reservationNumber: "Número de reserva:",
    dates: "Fechas:",
    duration: "Duración:",
    days: "días",
    bikes: "Bicicletas:",
    size: "Talla",
    quantity: "Cantidad",
    accessories: "Accesorios:",
    insurance: "Seguro:",
    yes: "Sí",
    no: "No",
    total: "Total pagado:",
    deposit: "Depósito (a pagar en efectivo):",
    nextSteps: "Próximos pasos:",
    step1: "• Ven a nuestro local el día de inicio del alquiler",
    step2: "• Trae tu DNI/Pasaporte y el depósito en efectivo",
    step3: "• Revisaremos las bicicletas contigo antes de la entrega",
    contact: "Contacto:",
    thanks: "¡Gracias por elegir Altea Bike Shop!",
    team: "El equipo de Altea Bike Shop",
  },
  en: {
    subject: "Booking Confirmation - Altea Bike Shop",
    greeting: "Hello",
    confirmed: "Your reservation has been confirmed successfully!",
    details: "Reservation details:",
    reservationNumber: "Reservation number:",
    dates: "Dates:",
    duration: "Duration:",
    days: "days",
    bikes: "Bikes:",
    size: "Size",
    quantity: "Quantity",
    accessories: "Accessories:",
    insurance: "Insurance:",
    yes: "Yes",
    no: "No",
    total: "Total paid:",
    deposit: "Deposit (to pay in cash):",
    nextSteps: "Next steps:",
    step1: "• Come to our store on the rental start date",
    step2: "• Bring your ID/Passport and the cash deposit",
    step3: "• We will review the bikes with you before delivery",
    contact: "Contact:",
    thanks: "Thank you for choosing Altea Bike Shop!",
    team: "The Altea Bike Shop team",
  },
  nl: {
    subject: "Reserveringsbevestiging - Altea Bike Shop",
    greeting: "Hallo",
    confirmed: "Uw reservering is succesvol bevestigd!",
    details: "Reserveringsdetails:",
    reservationNumber: "Reserveringsnummer:",
    dates: "Datums:",
    duration: "Duur:",
    days: "dagen",
    bikes: "Fietsen:",
    size: "Maat",
    quantity: "Aantal",
    accessories: "Accessoires:",
    insurance: "Verzekering:",
    yes: "Ja",
    no: "Nee",
    total: "Totaal betaald:",
    deposit: "Borg (contant te betalen):",
    nextSteps: "Volgende stappen:",
    step1: "• Kom naar onze winkel op de startdatum van de verhuur",
    step2: "• Breng uw ID/Paspoort en de contante borg mee",
    step3: "• We controleren de fietsen samen met u voor de levering",
    contact: "Contact:",
    thanks: "Bedankt voor het kiezen van Altea Bike Shop!",
    team: "Het Altea Bike Shop team",
  }
};

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.error("Email service not configured");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  try {
    const { to, subject, reservationData, language = "es" } = await request.json();

    // Función para obtener nombres de bicicletas desde Supabase
    const getBikeNames = async (bikeItems: BikeItem[], lang: string): Promise<Array<{title: string, size: string, quantity: number}>> => {
      const bikeIds = bikeItems.map(b => b.id);
      const { data, error } = await supabase
        .from('bikes')
        .select('id, title_es, title_en, title_nl, size')
        .in('id', bikeIds);

      if (error) throw error;

      return bikeItems.map(bike => {
        const bikeData = data?.find((b: BikeData) => b.id === bike.id);
        const titleKey = `title_${lang}` as keyof BikeData;
        const title = (bikeData && (bikeData[titleKey] || bikeData.title_es)) || 'Bicicleta';
        return {
          title,
          size: bike.size || bikeData?.size || 'M',
          quantity: bike.quantity
        };
      });
    };

    // Función para obtener nombres de accesorios desde Supabase
    const getAccessoryNames = async (accessoryItems: AccessoryItem[], lang: string): Promise<Array<{name: string, quantity: number}>> => {
      const accessoryIds = accessoryItems.map(a => a.id);
      const { data, error } = await supabase
        .from('accessories')
        .select('id, name_es, name_en, name_nl')
        .in('id', accessoryIds);

      if (error) throw error;

      return accessoryItems.map(accessory => {
        const accessoryData = data?.find((a: AccessoryData) => a.id === accessory.id);
        const nameKey = `name_${lang}` as keyof AccessoryData;
        const name = (accessoryData && (accessoryData[nameKey] || accessoryData.name_es)) || 'Accesorio';
        return {
          name,
          quantity: accessory.quantity || 1
        };
      });
    };

    const getEmailContent = async (data: ReservationData, lang: string) => {
      // Obtener datos traducidos
      const [translatedBikes, translatedAccessories] = await Promise.all([
        getBikeNames(data.bikes, lang),
        getAccessoryNames(data.accessories, lang)
      ]);

      // Función para formatear la fecha en hora española (CEST)
      const formatSpanishTime = (dateString: string) => {
        const date = new Date(dateString);
        // Ajustar a hora española (UTC+2 en verano)
        const adjustedDate = new Date(date.getTime() + (2 * 60 * 60 * 1000));
        return adjustedDate.toLocaleDateString(lang, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) + 'h';
      };

      const t = (translations as Record<string, any>)[lang] || translations.es;

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #16a34a; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .details { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .bike-item { margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 3px; }
            .total { font-weight: bold; font-size: 18px; color: #16a34a; }
            .footer { text-align: center; padding: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Altea Bike Shop</h1>
              <p>${t.confirmed}</p>
            </div>
            
            <div class="content">
              <p>${t.greeting} ${data.customer_name},</p>
              
              <div class="details">
                <h3>${t.details}</h3>
                <p><strong>${t.reservationNumber}</strong> ${data.id}</p>
                <p><strong>${t.dates}</strong> ${formatSpanishTime(data.start_date)} - ${formatSpanishTime(data.end_date)}</p>
                <p><strong>${t.duration}</strong> ${data.total_days} ${t.days}</p>
              </div>

              <div class="details">
                <h3>${t.bikes}</h3>
                ${translatedBikes
                  .map(
                    (bike) => `
                  <div class="bike-item">
                    <strong>${bike.title}</strong><br>
                    ${t.size}: ${bike.size} | ${t.quantity}: ${bike.quantity}
                  </div>
                `
                  )
                  .join("")}
              </div>

              ${
                translatedAccessories.length > 0
                  ? `
                <div class="details">
                  <h3>${t.accessories}</h3>
                  ${translatedAccessories.map(acc => `<p>• ${acc.name}${acc.quantity && acc.quantity > 1 ? ` (x${acc.quantity})` : ''}</p>`).join("")}
                </div>
              `
                  : ""
              }

              <div class="details">
                <p><strong>${t.insurance}</strong> ${data.insurance ? t.yes : t.no}</p>
                <p class="total">${t.total} ${data.total_amount}€</p>
                <p><strong>${t.deposit}</strong> ${data.deposit_amount}€</p>
              </div>

              <div class="details">
                <h3>${t.nextSteps}</h3>
                <p>${t.step1}</p>
                <p>${t.step2}</p>
                <p>${t.step3}</p>
              </div>

              <div class="details">
                <h3>${t.contact}</h3>
                <p>📍 Altea, Alicante</p>
                <p>📞 +34 XXX XXX XXX</p>
                <p>✉️ info@alteabikeshop.com</p>
              </div>
            </div>

            <div class="footer">
              <p>${t.thanks}</p>
              <p>${t.team}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    };

    const emailHtml = await getEmailContent(reservationData, language);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "no-reply@alteabikeshop.com",
      to: [to],
      subject: subject || (translations as Record<string, any>)[language]?.subject || translations.es.subject,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: emailData });
  } catch (error) {
    console.error("Error in send-email API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}