import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Mapeo fijo (empresa): id -> nombre+dirección
const LOCATION_MAP: Record<string, { name: string; address: string }> = {
  sucursal_altea: {
    name: "Altea Bike Shop",
    address: "Calle la Tella 2, Altea 03590",
  },
  sucursal_albir: {
    name: "Albir Cycling",
    address: "Av del Albir 159, El Albir",
  },
};

function safeJsonParse<T>(value: any, fallback: T): T {
  try {
    if (typeof value !== "string") return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeBikes(reservationData: any) {
  // 1) bikes array directo
  if (Array.isArray(reservationData?.bikes)) {
    return reservationData.bikes.map((b: any) => ({
      model: b.model ?? b.title_es ?? b.title ?? "Bicicleta",
      category: b.category ?? b.type ?? "-",
      size: b.size ?? "-",
      quantity: Number(b.quantity ?? 1),
    }));
  }

  // 2) bikes_data como string JSON (por ejemplo desde metadata)
  const bikesData = safeJsonParse<any[]>(reservationData?.bikes_data, []);
  if (Array.isArray(bikesData) && bikesData.length > 0) {
    return bikesData.map((b: any) => ({
      model: b.model ?? b.title_es ?? "Bicicleta",
      category: b.category ?? "-",
      size: b.size ?? "-",
      quantity: Number(b.quantity ?? 1),
    }));
  }

  return [];
}

function resolveLocation(reservationData: any) {
  // Puede venir como pickup_location string
  const pickupLocation = reservationData?.pickup_location;

  if (typeof pickupLocation === "string" && LOCATION_MAP[pickupLocation]) {
    return LOCATION_MAP[pickupLocation];
  }

  // Puede venir como objeto location
  const loc = reservationData?.location;
  if (loc && typeof loc === "object") {
    const name = loc.name ?? "Altea Bike Shop";
    const address = loc.address ?? "";
    return { name, address };
  }

  // Fallback
  return LOCATION_MAP.sucursal_altea;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, reservationData } = body;

    if (!to || !reservationData) {
      return NextResponse.json(
        { ok: false, error: "Falta 'to' o 'reservationData'." },
        { status: 400 }
      );
    }

    // ====== Datos 1:1 (solo mostramos lo que viene) ======
    const customerName =
      reservationData?.customer?.name ??
      reservationData?.customer_name ??
      "Cliente";

    const startDate =
      reservationData?.start_date ?? reservationData?.startDate ?? "-";
    const endDate =
      reservationData?.end_date ?? reservationData?.endDate ?? "-";

    const pickupTime =
      reservationData?.pickup_time ?? reservationData?.pickupTime ?? "-";
    const returnTime =
      reservationData?.return_time ?? reservationData?.returnTime ?? "-";

    const insurance =
      reservationData?.insurance === true ||
      reservationData?.insurance === "1" ||
      reservationData?.hasInsurance === true
        ? "Incluido"
        : "No incluido";

    // OJO: total puede venir en euros (ej 61.00) o en centimos (6100)
    // NO recalculamos: solo mostramos. Si viene en centimos, convertimos.
    const rawTotal = reservationData?.total_price ?? reservationData?.total_amount ?? null;
    const rawDeposit = reservationData?.deposit ?? reservationData?.deposit_amount ?? null;

    const formatMoney = (v: any) => {
      if (v === null || v === undefined || v === "-") return "-";
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);

      // Heurística: si es muy grande, probablemente centimos
      const euros = n > 999 ? n / 100 : n;
      return euros.toFixed(2);
    };

    const total = formatMoney(rawTotal);
    const deposit = formatMoney(rawDeposit);

    const loc = resolveLocation(reservationData);
    const locationFull = loc.address ? `${loc.name} – ${loc.address}` : loc.name;

    const bikes = normalizeBikes(reservationData);

    const bikesHtml =
      bikes.length > 0
        ? bikes
            .map(
              (b: any) => `
              <tr>
                <td style="padding:8px;border:1px solid #ddd;">${b.model}</td>
                <td style="padding:8px;border:1px solid #ddd;">${b.category}</td>
                <td style="padding:8px;border:1px solid #ddd;">${b.size}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${b.quantity}</td>
              </tr>
            `
            )
            .join("")
        : `
          <tr>
            <td colspan="4" style="padding:10px;border:1px solid #ddd;color:#666;">
              No se pudieron leer las bicicletas de la reserva (revisar estructura de reservationData).
            </td>
          </tr>
        `;

    const subject = "Reserva confirmada – Altea Bike Shop";

    const html = `
      <div style="font-family:Arial, sans-serif; max-width:650px; margin:auto; color:#111;">
        <h2 style="border-bottom:2px solid #000;padding-bottom:10px;">
          ${subject}
        </h2>

        <p>Hola <b>${customerName}</b>,</p>
        <p>Tu reserva fue confirmada correctamente.</p>

        <p><b>Fecha inicio:</b> ${startDate}</p>
        <p><b>Fecha fin:</b> ${endDate}</p>
        <p><b>Horario de retiro:</b> ${pickupTime}</p>
        <p><b>Horario de devolución:</b> ${returnTime}</p>
        <p><b>Ubicación:</b> ${locationFull}</p>

        <h3 style="margin-top:25px;">Bicicletas reservadas</h3>

        <table style="border-collapse:collapse;width:100%; margin-top:10px;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;background:#f2f2f2;">Modelo</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f2f2f2;">Categoría</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f2f2f2;">Talle</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f2f2f2;">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${bikesHtml}
          </tbody>
        </table>

        <p style="margin-top:15px;"><b>Seguro:</b> ${insurance}</p>
        <p><b>Depósito:</b> €${deposit}</p>
        <h3 style="margin-top:10px;">Total pagado: €${total}</h3>

        <hr style="margin-top:30px;border:none;border-top:1px solid #ddd;"/>

        <div style="font-size:13px;color:#444;line-height:1.6;margin-top:15px;">
          <p style="font-weight:bold;margin-bottom:5px;">Altea Bike Shop</p>
          <p>📍 Calle la Tella 2, Altea 03590</p>
          <p>📞 +34 604 535 972</p>
          <p>✉️ alteabikeshop@gmail.com</p>
          <p>🕒 Lunes a Viernes: 10:00 - 18:00</p>
          <p>🕒 Sábados: 10:00 - 14:00</p>

          <br/>

          <p style="font-weight:bold;margin-bottom:5px;">Albir Cycling</p>
          <p>📍 Av del Albir 159, El Albir</p>
          <p>✉️ info@albir-cycling.com</p>
          <p>🕒 Lunes a Viernes: 10:00 - 18:00</p>
          <p>🕒 Sábados: 10:00 - 14:00</p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: "Altea Bike Shop <reservas@alteabikeshop.com>",
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error("RESEND ERROR:", result.error);
      throw result.error;
    }

    return NextResponse.json({ ok: true, id: result.data?.id });
  } catch (error: any) {
    console.error("EMAIL ERROR:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Error enviando email" },
      { status: 500 }
    );
  }
}
