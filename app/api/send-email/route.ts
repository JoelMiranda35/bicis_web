import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

interface BikeItem {
  title: string;
  name?: string;
  size: string;
  quantity: number;
}

interface AccessoryItem {
  name: string;
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
}

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  if (!process.env.EMAIL_FROM) {
    console.error("EMAIL_FROM is not configured");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  try {
    const { to, subject, reservationData, language = "es" } = await request.json();

    const getEmailContent = (data: ReservationData, lang: string) => {
      // Función para formatear la fecha correctamente
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(lang, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) + 'h';
      };

      // Función para mostrar correctamente los accesorios
      const displayAccessories = (accessories: AccessoryItem[]) => {
        if (!accessories) return '';
        return accessories.map(acc => {
          const name = typeof acc === 'string' ? acc : acc.name || acc;
          return `<p>• ${name}</p>`;
        }).join("");
      };

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
        },
      };

      const t = translations[lang as keyof typeof translations] || translations.es;

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
                <p><strong>${t.dates}</strong> ${formatDate(data.start_date)} - ${formatDate(data.end_date)}</p>
                <p><strong>${t.duration}</strong> ${data.total_days} ${t.days}</p>
              </div>

              <div class="details">
                <h3>${t.bikes}</h3>
                ${data.bikes
                  .map(
                    (bike) => `
                  <div class="bike-item">
                    <strong>${bike.title || bike.name || 'Bicicleta'}</strong><br>
                    ${t.size}: ${bike.size} | ${t.quantity}: ${bike.quantity}
                  </div>
                `
                  )
                  .join("")}
              </div>

              ${
                data.accessories && data.accessories.length > 0
                  ? `
                <div class="details">
                  <h3>${t.accessories}</h3>
                  ${displayAccessories(data.accessories)}
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
                <p>✉️ info@alterbikeshop.com</p>
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

    const emailHtml = getEmailContent(reservationData, language);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "no-reply@alteabikeshop.com",
      to: [to],
      subject: subject,
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