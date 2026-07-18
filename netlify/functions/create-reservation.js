const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateReference() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NCC-${date}-${rand}`;
}

// Peak season: Christmas/New Year (Dec 21 - Jan 6) and Holy Week (Mar 21-28) — same window every year
function isPeakDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (month === 12 && day >= 21) return true;
  if (month === 1 && day <= 6) return true;
  if (month === 3 && day >= 21 && day <= 28) return true;
  return false;
}

// Sums nightly guest-facing price and owner payout across a stay, night by night,
// applying the peak-season rate where applicable. For per-person properties
// (Castillo Colonial) each night's rate is multiplied by guest count.
function calcStayTotals(property, check_in, check_out, numGuests) {
  const mult = property.pricing_unit === 'per_person' ? numGuests : 1;
  let accommodation_total = 0;
  let owner_payout = 0;
  let nights = 0;
  let cur = new Date(check_in + 'T00:00:00Z');
  const end = new Date(check_out + 'T00:00:00Z');
  while (cur < end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const peak = isPeakDate(dateStr);
    const rate = peak && property.peak_price_per_night != null ? property.peak_price_per_night : property.price_per_night;
    const ownerRate = peak && property.peak_owner_payout_per_night != null ? property.peak_owner_payout_per_night : property.owner_payout_per_night;
    accommodation_total += rate * mult;
    owner_payout += (ownerRate != null ? ownerRate : rate) * mult;
    nights++;
    cur = new Date(cur.getTime() + 86400000);
  }
  return { nights, accommodation_total, owner_payout };
}

async function createPayPalOrder(amount, reference) {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const baseUrl =
    process.env.PAYPAL_MODE === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`PayPal token failed: ${JSON.stringify(tokenData)}`);
  }
  const access_token = tokenData.access_token;

  const siteUrl = process.env.SITE_URL || 'https://nosara-collective.netlify.app';
  const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: reference,
          description: `Nosara Collective Conscience - ${reference}`,
          amount: { currency_code: 'USD', value: amount.toFixed(2) },
        },
      ],
      application_context: {
        return_url: `${siteUrl}/?payment=success&ref=${reference}`,
        cancel_url: `${siteUrl}/?payment=cancelled`,
        brand_name: 'Nosara Collective Conscience',
        user_action: 'PAY_NOW',
      },
    }),
  });

  const order = await orderRes.json();
  if (!order.id) {
    throw new Error(`PayPal order failed: ${JSON.stringify(order)}`);
  }
  const approvalUrl = order.links?.find((l) => l.rel === 'approve')?.href;
  if (!approvalUrl) {
    throw new Error(`PayPal no approval URL: ${JSON.stringify(order)}`);
  }
  return { orderId: order.id, approvalUrl };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    property_id,
    guest_name,
    guest_email,
    guest_phone,
    guest_country,
    check_in,
    check_out,
    num_guests,
    payment_method,
    services,
    notes,
  } = body;

  if (!property_id || !guest_name || !guest_email || !check_in || !check_out || !num_guests || !payment_method) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Get property first — accept either UUID or slug
  const isUUID = /^[0-9a-f-]{36}$/.test(property_id);
  const { data: property, error: propErr } = await supabase
    .from('properties')
    .select('id, name, price_per_night, owner_payout_per_night, peak_price_per_night, peak_owner_payout_per_night, pricing_unit, min_guests, min_nights')
    .eq(isUUID ? 'id' : 'slug', property_id)
    .single();

  if (propErr || !property) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Property not found' }) };
  }

  const nightsRequested = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
  if (property.min_nights && nightsRequested < property.min_nights) {
    return { statusCode: 400, body: JSON.stringify({ error: `Minimum stay is ${property.min_nights} nights` }) };
  }
  if (property.min_guests && num_guests < property.min_guests) {
    return { statusCode: 400, body: JSON.stringify({ error: `Minimum ${property.min_guests} guests required` }) };
  }

  // Check availability using the real UUID
  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('property_id', property.id)
    .gte('date', check_in)
    .lt('date', check_out);

  if (blocked && blocked.length > 0) {
    return {
      statusCode: 409,
      body: JSON.stringify({ error: 'Selected dates are not available', blocked_dates: blocked.map((b) => b.date) }),
    };
  }

  // accommodation_total is already the final, all-inclusive guest-facing price
  // (season + guest-count aware) — nothing gets added on top at checkout.
  const { nights, accommodation_total, owner_payout } = calcStayTotals(property, check_in, check_out, num_guests);
  const grand_total = accommodation_total;
  const taxes = Math.round(accommodation_total * 0.13);
  const company_allocation = accommodation_total - owner_payout - taxes;
  const ncc_fee = company_allocation;
  const community_impact = Math.round(company_allocation * 0.05);

  const reference = generateReference();

  const { data: reservation, error: resErr } = await supabase
    .from('reservations')
    .insert({
      reference,
      property_id: property.id,
      guest_name,
      guest_email,
      guest_phone,
      guest_country,
      check_in,
      check_out,
      nights,
      num_guests,
      accommodation_total,
      taxes,
      grand_total,
      community_impact,
      owner_payout,
      company_allocation,
      payment_method,
      payment_status: 'pending',
      services: services || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (resErr) {
    console.error('Reservation insert error:', resErr);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create reservation' }) };
  }

  const response = {
    reservation_id: reservation.id,
    reference,
    property_name: property.name,
    nights,
    accommodation_total,
    ncc_fee,
    taxes,
    grand_total,
    community_impact,
    payment_method,
  };

  if (payment_method === 'paypal') {
    try {
      const { orderId, approvalUrl } = await createPayPalOrder(grand_total, reference);
      await supabase
        .from('reservations')
        .update({ paypal_order_id: orderId })
        .eq('id', reservation.id);
      response.paypal_order_id = orderId;
      response.paypal_approval_url = approvalUrl;
    } catch (e) {
      console.error('PayPal order error:', e);
      return { statusCode: 500, body: JSON.stringify({ error: 'PayPal order creation failed', detail: e.message }) };
    }
  } else if (payment_method === 'wise') {
    response.wise_instructions = {
      account_name: process.env.WISE_ACCOUNT_NAME || 'Nosara Collective Conscience',
      email: process.env.WISE_EMAIL || 'info@nosaracollectiveconscience.com',
      amount: grand_total,
      currency: 'USD',
      reference,
      note: `Please include your booking reference ${reference} in the payment description`,
    };
    await supabase
      .from('reservations')
      .update({ payment_status: 'pending', wise_reference: reference })
      .eq('id', reservation.id);
  } else if (payment_method === 'bank_transfer') {
    // Block dates temporarily for 28 hours
    const holdExpiry = new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString();
    const dates = [];
    let cur = new Date(check_in);
    const end = new Date(check_out);
    while (cur < end) {
      dates.push({
        property_id: property.id,
        date: cur.toISOString().slice(0, 10),
        source: 'hold',
        reservation_id: reservation.id,
      });
      cur = new Date(cur.getTime() + 86400000);
    }
    await supabase.from('blocked_dates').upsert(dates, { onConflict: 'property_id,date' });
    await supabase
      .from('reservations')
      .update({ payment_status: 'pending_bank_transfer', hold_expires_at: holdExpiry })
      .eq('id', reservation.id);

    // Notify admin via email
    const adminHtml = `
<!DOCTYPE html><html><body style="font-family:monospace;background:#1A1916;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#252520;border:1px solid #3A3830;padding:32px">
  <div style="color:#C4784A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px">⏳ BANK TRANSFER HOLD — 28 HOURS</div>
  <div style="color:#F0EDE6;font-size:20px;margin-bottom:24px">${reference}</div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;color:#A0988E">
    <tr><td style="padding:5px 0">Guest</td><td style="color:#F0EDE6;text-align:right">${guest_name}</td></tr>
    <tr><td style="padding:5px 0">Email</td><td style="color:#F0EDE6;text-align:right">${guest_email}</td></tr>
    <tr><td style="padding:5px 0">Phone / WhatsApp</td><td style="color:#F0EDE6;text-align:right">${guest_phone || '—'}</td></tr>
    <tr><td style="padding:5px 0">Property</td><td style="color:#F0EDE6;text-align:right">${property.name}</td></tr>
    <tr><td style="padding:5px 0">Check-in</td><td style="color:#F0EDE6;text-align:right">${check_in}</td></tr>
    <tr><td style="padding:5px 0">Check-out</td><td style="color:#F0EDE6;text-align:right">${check_out}</td></tr>
    <tr><td style="padding:5px 0">Nights</td><td style="color:#F0EDE6;text-align:right">${nights}</td></tr>
    <tr style="border-top:1px solid #3A3830"><td style="padding:8px 0 3px;color:#C4784A">Total to Receive</td><td style="color:#C4784A;text-align:right;font-size:16px">$${grand_total.toLocaleString()}</td></tr>
  </table>
  <div style="margin-top:24px;background:#2A3020;border:1px solid #4A6030;padding:16px;color:#8ABA6A;font-size:13px;line-height:1.8">
    ⚡ ACTION REQUIRED<br>
    Send your BAC Credomatic bank details to this guest via WhatsApp NOW.<br>
    Hold expires in 28 hours. If payment not received, dates will be released automatically.
  </div>
</div>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nosara Collective <bookings@nosaracollectiveconscience.com>',
        to: process.env.ADMIN_EMAIL,
        subject: `[NCC] ⏳ Bank Transfer Hold ${reference} — ${property.name} — SEND BANK DETAILS NOW`,
        html: adminHtml,
      }),
    });

    // Send guest confirmation email
    const guestHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Helvetica Neue',sans-serif;background:#F2EDE4;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#FDFAF5;border:2px solid #141210">
    <div style="background:#141210;padding:32px 40px">
      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:8px;font-weight:700">NOSARA COLLECTIVE CONSCIENCE</div>
      <div style="font-size:24px;color:#FDFAF5;font-weight:300;letter-spacing:0.04em">Dates Held — Awaiting Payment</div>
    </div>
    <div style="padding:40px">
      <p style="color:#5A5548;line-height:1.8;margin-bottom:24px">Dear ${guest_name},<br><br>
        Your selected dates at <strong style="color:#141210">${property.name}</strong> are now <strong>reserved exclusively for you for the next 28 hours</strong> while we process your bank transfer.
      </p>
      <div style="background:#FFF8E8;border:1px solid #E8C860;padding:20px;margin-bottom:24px;border-left:4px solid #E8C860">
        <div style="font-size:13px;color:#8A6A10;line-height:1.8">
          ⏳ <strong>28-Hour Hold Active</strong><br>
          Our team will send you the bank transfer details via WhatsApp and email within the next few minutes. Once we confirm receipt of funds, your booking will be fully confirmed.
        </div>
      </div>
      <div style="background:#F2EDE4;border:1px solid rgba(20,18,16,0.1);padding:24px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:16px;font-weight:700">Reservation Summary</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#5A5548">Reference</td><td style="padding:6px 0;font-weight:700;color:#141210;text-align:right">${reference}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Property</td><td style="padding:6px 0;color:#141210;text-align:right">${property.name}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Check-in</td><td style="padding:6px 0;color:#141210;text-align:right">${check_in}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Check-out</td><td style="padding:6px 0;color:#141210;text-align:right">${check_out}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Nights</td><td style="padding:6px 0;color:#141210;text-align:right">${nights}</td></tr>
          <tr style="border-top:1px solid rgba(20,18,16,0.15)"><td style="padding:10px 0 6px;font-weight:700;color:#141210">Total Amount</td><td style="padding:10px 0 6px;font-weight:700;color:#141210;text-align:right;font-size:18px">$${grand_total.toLocaleString()}</td></tr>
        </table>
      </div>
      <p style="color:#5A5548;font-size:13px;line-height:1.8">
        Questions? WhatsApp us: <a href="https://wa.me/${(process.env.ADMIN_WHATSAPP||'').replace('+','')}" style="color:#C4784A">${process.env.ADMIN_WHATSAPP}</a>
      </p>
      <div style="border-top:1px solid rgba(20,18,16,0.1);padding-top:20px;font-size:11px;color:#8A8278;line-height:1.8">
        Nosara Collective Conscience · Nosara, Guanacaste, Costa Rica<br>
        Travel with purpose. Stay with impact. 🌴
      </div>
    </div>
  </div>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nosara Collective <bookings@nosaracollectiveconscience.com>',
        to: guest_email,
        subject: `Dates Held for You — ${reference} · ${property.name}`,
        html: guestHtml,
      }),
    });

    response.bank_transfer = {
      hold_hours: 28,
      hold_expires_at: holdExpiry,
      message: 'Your dates are held for 28 hours. Bank details will be sent to you via WhatsApp and email shortly.',
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  };
};
