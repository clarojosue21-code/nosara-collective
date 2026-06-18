const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Use Resend's onboarding domain until nosaracollective.com is verified in Resend
      from: 'Nosara Collective <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

function guestEmail(r, property) {
  const checkIn = new Date(r.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const checkOut = new Date(r.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
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
      <p style="color:#5A5548;line-height:1.8;margin-bottom:24px">Dear ${r.guest_name},<br><br>
        Your reservation at <strong style="color:#141210">${property.name}</strong> has been confirmed. We look forward to welcoming you to Nosara!
      </p>

      <div style="background:#F2EDE4;border:1px solid rgba(20,18,16,0.1);padding:24px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:16px;font-weight:700">Reservation Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#5A5548">Reference</td><td style="padding:6px 0;font-weight:700;color:#141210;text-align:right">${r.reference}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Property</td><td style="padding:6px 0;color:#141210;text-align:right">${property.name}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Check-in</td><td style="padding:6px 0;color:#141210;text-align:right">${checkIn}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Check-out</td><td style="padding:6px 0;color:#141210;text-align:right">${checkOut}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Nights</td><td style="padding:6px 0;color:#141210;text-align:right">${r.nights}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Guests</td><td style="padding:6px 0;color:#141210;text-align:right">${r.num_guests}</td></tr>
        </table>
      </div>

      <div style="background:#F2EDE4;border:1px solid rgba(20,18,16,0.1);padding:24px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:16px;font-weight:700">Payment Summary</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#5A5548">Accommodation (${r.nights} nights)</td><td style="padding:6px 0;color:#141210;text-align:right">$${r.accommodation_total.toLocaleString()}</td></tr>
          <tr><td style="padding:6px 0;color:#5A5548">Taxes (13% IVA)</td><td style="padding:6px 0;color:#141210;text-align:right">$${r.taxes.toLocaleString()}</td></tr>
          <tr style="border-top:1px solid rgba(20,18,16,0.15)"><td style="padding:10px 0 6px;font-weight:700;color:#141210">Total</td><td style="padding:10px 0 6px;font-weight:700;color:#141210;text-align:right;font-size:18px">$${r.grand_total.toLocaleString()}</td></tr>
        </table>
      </div>

      <div style="background:rgba(43,122,142,0.08);border:1px solid rgba(43,122,142,0.2);padding:20px;margin-bottom:24px">
        <div style="font-size:13px;color:#1E5A6A;line-height:1.7">
          🌱 <strong>Community Impact: $${r.community_impact.toLocaleString()}</strong><br>
          5% of your accommodation total goes directly to local families in Nosara, Costa Rica. Thank you for traveling with purpose.
        </div>
      </div>

      <div style="margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:12px;font-weight:700">Need Help?</div>
        <p style="color:#5A5548;font-size:13px;line-height:1.8">
          Contact us on WhatsApp: <a href="https://wa.me/${(process.env.ADMIN_WHATSAPP || '').replace('+', '')}" style="color:#C4784A">${process.env.ADMIN_WHATSAPP}</a><br>
          Or email: <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#C4784A">${process.env.ADMIN_EMAIL}</a>
        </p>
      </div>

      <div style="border-top:1px solid rgba(20,18,16,0.1);padding-top:20px;font-size:11px;color:#8A8278;line-height:1.8">
        Nosara Collective Conscience · Nosara, Guanacaste, Costa Rica<br>
        Travel with purpose. Stay with impact. Surf good waves everyday 🌴
      </div>
    </div>
  </div>
</body>
</html>`;
}

function adminEmail(r, property) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:monospace;background:#1A1916;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#252520;border:1px solid #3A3830;padding:32px">
    <div style="color:#C4784A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px">NEW RESERVATION</div>
    <div style="color:#F0EDE6;font-size:20px;margin-bottom:24px">${r.reference}</div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#A0988E">
      <tr><td style="padding:5px 0">Guest</td><td style="color:#F0EDE6;text-align:right">${r.guest_name}</td></tr>
      <tr><td style="padding:5px 0">Email</td><td style="color:#F0EDE6;text-align:right">${r.guest_email}</td></tr>
      <tr><td style="padding:5px 0">Phone</td><td style="color:#F0EDE6;text-align:right">${r.guest_phone || '—'}</td></tr>
      <tr><td style="padding:5px 0">Country</td><td style="color:#F0EDE6;text-align:right">${r.guest_country || '—'}</td></tr>
      <tr><td style="padding:5px 0">Property</td><td style="color:#F0EDE6;text-align:right">${property.name}</td></tr>
      <tr><td style="padding:5px 0">Check-in</td><td style="color:#F0EDE6;text-align:right">${r.check_in}</td></tr>
      <tr><td style="padding:5px 0">Check-out</td><td style="color:#F0EDE6;text-align:right">${r.check_out}</td></tr>
      <tr><td style="padding:5px 0">Nights</td><td style="color:#F0EDE6;text-align:right">${r.nights}</td></tr>
      <tr><td style="padding:5px 0">Guests</td><td style="color:#F0EDE6;text-align:right">${r.num_guests}</td></tr>
      <tr><td style="padding:5px 0">Payment</td><td style="color:#F0EDE6;text-align:right">${r.payment_method.toUpperCase()}</td></tr>
      <tr style="border-top:1px solid #3A3830"><td style="padding:8px 0;color:#F0EDE6">Accommodation</td><td style="color:#F0EDE6;text-align:right">$${r.accommodation_total.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0">Taxes</td><td style="color:#F0EDE6;text-align:right">$${r.taxes.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#C4784A">Grand Total</td><td style="color:#C4784A;text-align:right;font-size:16px">$${r.grand_total.toLocaleString()}</td></tr>
      <tr style="border-top:1px solid #3A3830"><td style="padding:8px 0 3px;color:#6A9E6A">Owner Payout (90%)</td><td style="color:#6A9E6A;text-align:right">$${r.owner_payout.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#7AAAC0">Community Impact (5%)</td><td style="color:#7AAAC0;text-align:right">$${r.community_impact.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#D4906A">Company Allocation (5%)</td><td style="color:#D4906A;text-align:right">$${r.company_allocation.toLocaleString()}</td></tr>
    </table>
  </div>
</body>
</html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { reservation_id } = body;
  if (!reservation_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'reservation_id required' }) };
  }

  const { data: reservation, error } = await supabase
    .from('reservations')
    .select('*, properties(name, cover_image)')
    .eq('id', reservation_id)
    .single();

  if (error || !reservation) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Reservation not found' }) };
  }

  const property = reservation.properties || { name: 'Property' };

  try {
    await Promise.all([
      sendEmail({
        to: reservation.guest_email,
        subject: `Booking Confirmed — ${reservation.reference} · ${property.name}`,
        html: guestEmail(reservation, property),
      }),
      sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `[NCC] New Booking ${reservation.reference} — ${property.name}`,
        html: adminEmail(reservation, property),
      }),
    ]);
  } catch (e) {
    console.error('Email send failed:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Email delivery failed' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ sent: true }) };
};
