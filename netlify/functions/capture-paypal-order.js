const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPayPalToken() {
  const baseUrl = process.env.PAYPAL_MODE === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return { access_token: data.access_token, baseUrl };
}

async function sendConfirmationEmail(reservation, propertyName) {
  const checkIn = new Date(reservation.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const checkOut = new Date(reservation.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const guestHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Helvetica Neue',sans-serif;background:#F2EDE4;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#FDFAF5;border:2px solid #141210">
    <div style="background:#141210;padding:32px 40px">
      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:8px;font-weight:700">NOSARA COLLECTIVE CONSCIENCE</div>
      <div style="font-size:24px;color:#FDFAF5;font-weight:300;letter-spacing:0.04em">Booking Confirmed</div>
    </div>
    <div style="padding:40px">
      <p style="color:#5A5548;line-height:1.8;margin-bottom:24px">Dear ${reservation.guest_name},<br><br>
        Your reservation at <strong style="color:#141210">${propertyName}</strong> has been confirmed. We look forward to welcoming you to Nosara!
      </p>
      <div style="background:#F2EDE4;border:1px solid rgba(20,18,16,0.1);padding:24px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:16px;font-weight:700">Reservation Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#5A5548">Reference</td><td style="padding:6px 0;font-weight:700;color:#141210;text-align:right">${reservation.reference}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Property</td><td style="padding:6px 0;color:#141210;text-align:right">${propertyName}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Check-in</td><td style="padding:6px 0;color:#141210;text-align:right">${checkIn}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Check-out</td><td style="padding:6px 0;color:#141210;text-align:right">${checkOut}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Nights</td><td style="padding:6px 0;color:#141210;text-align:right">${reservation.nights}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Guests</td><td style="padding:6px 0;color:#141210;text-align:right">${reservation.num_guests}</td></tr>
        </table>
      </div>
      <div style="background:#F2EDE4;border:1px solid rgba(20,18,16,0.1);padding:24px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:16px;font-weight:700">Payment Summary</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#5A5548">Accommodation (${reservation.nights} nights)</td><td style="padding:6px 0;color:#141210;text-align:right">$${reservation.accommodation_total.toLocaleString()}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Local Impact & Flexibility Fee (10%)</td><td style="padding:6px 0;color:#141210;text-align:right">$${Math.round(reservation.accommodation_total*0.10).toLocaleString()}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Taxes (13% IVA)</td><td style="padding:6px 0;color:#141210;text-align:right">$${reservation.taxes.toLocaleString()}</td></tr>
          <tr style="border-top:1px solid rgba(20,18,16,0.15)"><td style="padding:10px 0 6px;font-weight:700;color:#141210">Total Paid</td><td style="padding:10px 0 6px;font-weight:700;color:#141210;text-align:right;font-size:18px">$${reservation.grand_total.toLocaleString()}</td></tr>
        </table>
      </div>
      <div style="background:rgba(43,122,142,0.08);border:1px solid rgba(43,122,142,0.2);padding:20px;margin-bottom:24px">
        <div style="font-size:13px;color:#1E5A6A;line-height:1.7">
          🌱 <strong>Community Impact: $${reservation.community_impact.toLocaleString()}</strong><br>
          5% of your accommodation total goes directly to local families in Nosara, Costa Rica. Thank you for traveling with purpose.
        </div>
      </div>
      <p style="color:#5A5548;font-size:13px;line-height:1.8">
        Questions? WhatsApp us: <a href="https://wa.me/${(process.env.ADMIN_WHATSAPP || '').replace('+', '')}" style="color:#C4784A">${process.env.ADMIN_WHATSAPP}</a><br>
        Or email: <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#C4784A">${process.env.ADMIN_EMAIL}</a>
      </p>
      <div style="border-top:1px solid rgba(20,18,16,0.1);padding-top:20px;font-size:11px;color:#8A8278;line-height:1.8">
        Nosara Collective Conscience · Nosara, Guanacaste, Costa Rica<br>
        Travel with purpose. Stay with impact. 🌴
      </div>
    </div>
  </div>
</body>
</html>`;

  const adminHtml = `
<!DOCTYPE html>
<html>
<body style="font-family:monospace;background:#1A1916;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#252520;border:1px solid #3A3830;padding:32px">
    <div style="color:#C4784A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px">NEW PAYPAL BOOKING</div>
    <div style="color:#F0EDE6;font-size:20px;margin-bottom:24px">${reservation.reference}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#A0988E">
      <tr><td style="padding:5px 0">Guest</td><td style="color:#F0EDE6;text-align:right">${reservation.guest_name}</td></tr>
      <tr><td style="padding:5px 0">Email</td><td style="color:#F0EDE6;text-align:right">${reservation.guest_email}</td></tr>
      <tr><td style="padding:5px 0">Phone</td><td style="color:#F0EDE6;text-align:right">${reservation.guest_phone || '—'}</td></tr>
      <tr><td style="padding:5px 0">Property</td><td style="color:#F0EDE6;text-align:right">${propertyName}</td></tr>
      <tr><td style="padding:5px 0">Check-in</td><td style="color:#F0EDE6;text-align:right">${reservation.check_in}</td></tr>
      <tr><td style="padding:5px 0">Check-out</td><td style="color:#F0EDE6;text-align:right">${reservation.check_out}</td></tr>
      <tr><td style="padding:5px 0">Nights</td><td style="color:#F0EDE6;text-align:right">${reservation.nights}</td></tr>
      <tr><td style="padding:5px 0">Guests</td><td style="color:#F0EDE6;text-align:right">${reservation.num_guests}</td></tr>
      <tr style="border-top:1px solid #3A3830"><td style="padding:8px 0 3px;color:#C4784A">Grand Total</td><td style="color:#C4784A;text-align:right;font-size:16px">$${reservation.grand_total.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#6A9E6A">Owner Payout (90%)</td><td style="color:#6A9E6A;text-align:right">$${reservation.owner_payout.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#7AAAC0">Community Impact (5%)</td><td style="color:#7AAAC0;text-align:right">$${reservation.community_impact.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#D4906A">Company Allocation (5%)</td><td style="color:#D4906A;text-align:right">$${reservation.company_allocation.toLocaleString()}</td></tr>
    </table>
  </div>
</body>
</html>`;

  const sendEmail = async (to, subject, html) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Nosara Collective <bookings@nosaracollectiveconscience.com>',
        to,
        subject,
        html,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
    return data;
  };

  await Promise.all([
    sendEmail(reservation.guest_email, `Booking Confirmed — ${reservation.reference} · ${propertyName}`, guestHtml),
    sendEmail(process.env.ADMIN_EMAIL, `[NCC] New PayPal Booking ${reservation.reference} — ${propertyName}`, adminHtml),
  ]);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { order_id, reference } = body;
  if (!order_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id required' }) };
  }

  try {
    const { access_token, baseUrl } = await getPayPalToken();

    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const capture = await captureRes.json();

    if (capture.status !== 'COMPLETED') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Payment not completed', status: capture.status, detail: capture }) };
    }

    // Update reservation to paid
    const { data: reservation, error: updateErr } = await supabase
      .from('reservations')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('reference', reference)
      .select('*, properties(name)')
      .single();

    if (updateErr || !reservation) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Reservation not found', detail: updateErr?.message }) };
    }

    const propertyName = reservation.properties?.name || 'Property';

    // Block dates
    const dates = [];
    let cur = new Date(reservation.check_in);
    const end = new Date(reservation.check_out);
    while (cur < end) {
      dates.push({
        property_id: reservation.property_id,
        date: cur.toISOString().slice(0, 10),
        source: 'reservation',
        reservation_id: reservation.id,
      });
      cur = new Date(cur.getTime() + 86400000);
    }
    await supabase.from('blocked_dates').upsert(dates, { onConflict: 'property_id,date' });

    // Send emails directly
    await sendConfirmationEmail(reservation, propertyName);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, reference }),
    };
  } catch (e) {
    console.error('Capture error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Capture failed', detail: e.message }) };
  }
};
