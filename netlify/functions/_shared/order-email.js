// Single source of truth for the order confirmation email (guest + admin
// copies). Both capture-paypal-order.js and paypal-webhook.js call this —
// never duplicate this template again, that's exactly how the old
// double-charge/stale-label bugs happened.

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function itemRows(items) {
  return items.map((it) => {
    if (it.item_type === 'property') {
      return `<tr><td style="padding:6px 0;color:#5A5548">${it.name} (${fmtDate(it.check_in)} → ${fmtDate(it.check_out)}, ${it.nights} night${it.nights !== 1 ? 's' : ''}, ${it.num_guests} guest${it.num_guests !== 1 ? 's' : ''})</td><td style="padding:6px 0;color:#141210;text-align:right">$${it.price.toLocaleString()}</td></tr>`;
    }
    return `<tr><td style="padding:6px 0;color:#5A5548">${it.name}</td><td style="padding:6px 0;color:#141210;text-align:right">$${it.price.toLocaleString()}</td></tr>`;
  }).join('');
}

function itemRowsPlain(items) {
  return items.map((it) => {
    if (it.item_type === 'property') {
      return `<tr><td style="padding:5px 0">${it.name}</td><td style="color:#F0EDE6;text-align:right">${it.check_in} → ${it.check_out} · ${it.nights}n · ${it.num_guests}g · $${it.price.toLocaleString()}</td></tr>`;
    }
    return `<tr><td style="padding:5px 0">${it.name}</td><td style="color:#F0EDE6;text-align:right">$${it.price.toLocaleString()}</td></tr>`;
  }).join('');
}

function guestEmailHtml(order, items) {
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
      <p style="color:#5A5548;line-height:1.8;margin-bottom:24px">Dear ${order.guest_name},<br><br>
        Your reservation has been confirmed. We look forward to welcoming you to Nosara!
      </p>
      <div style="background:#F2EDE4;border:1px solid rgba(20,18,16,0.1);padding:24px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C4784A;margin-bottom:16px;font-weight:700">Reference: ${order.reference}</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${itemRows(items)}
          <tr style="border-top:1px solid rgba(20,18,16,0.15)"><td style="padding:10px 0 6px;font-weight:700;color:#141210">Total Paid</td><td style="padding:10px 0 6px;font-weight:700;color:#141210;text-align:right;font-size:18px">$${order.grand_total.toLocaleString()}</td></tr>
        </table>
      </div>
      <div style="background:rgba(43,122,142,0.08);border:1px solid rgba(43,122,142,0.2);padding:20px;margin-bottom:24px">
        <div style="font-size:13px;color:#1E5A6A;line-height:1.7">
          🌱 <strong>5% of our profits</strong> go directly to local families in Nosara, Costa Rica. Thank you for traveling with purpose.
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
}

function adminEmailHtml(order, items) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:monospace;background:#1A1916;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#252520;border:1px solid #3A3830;padding:32px">
    <div style="color:#C4784A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px">NEW BOOKING PAID — ${order.payment_method.toUpperCase()}</div>
    <div style="color:#F0EDE6;font-size:20px;margin-bottom:24px">${order.reference}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#A0988E">
      <tr><td style="padding:5px 0">Guest</td><td style="color:#F0EDE6;text-align:right">${order.guest_name}</td></tr>
      <tr><td style="padding:5px 0">Email</td><td style="color:#F0EDE6;text-align:right">${order.guest_email}</td></tr>
      <tr><td style="padding:5px 0">Phone</td><td style="color:#F0EDE6;text-align:right">${order.guest_phone || '—'}</td></tr>
      <tr style="border-top:1px solid #3A3830"><td colspan="2" style="padding:8px 0 3px;color:#C4784A">Items</td></tr>
      ${itemRowsPlain(items)}
      <tr style="border-top:1px solid #3A3830"><td style="padding:8px 0 3px;color:#C4784A">Grand Total</td><td style="color:#C4784A;text-align:right;font-size:16px">$${order.grand_total.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#6A9E6A">Owner Payout</td><td style="color:#6A9E6A;text-align:right">$${order.owner_payout_total.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#D4906A">NCC Margin</td><td style="color:#D4906A;text-align:right">$${order.ncc_fee_total.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#7AAAC0">— Community Impact (5% of margin)</td><td style="color:#7AAAC0;text-align:right">$${order.community_impact_total.toLocaleString()}</td></tr>
      <tr><td style="padding:3px 0;color:#A0988E">Taxes (13% IVA)</td><td style="color:#A0988E;text-align:right">$${order.taxes_total.toLocaleString()}</td></tr>
    </table>
  </div>
</body>
</html>`;
}

async function sendOrderConfirmation(order, items) {
  const send = async (to, subject, html) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Nosara Collective <bookings@nosaracollectiveconscience.com>', to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
    return data;
  };
  await Promise.all([
    send(order.guest_email, `Booking Confirmed — ${order.reference}`, guestEmailHtml(order, items)),
    send(process.env.ADMIN_EMAIL, `[NCC] New Booking Paid ${order.reference}`, adminEmailHtml(order, items)),
  ]);
}

module.exports = { sendOrderConfirmation, guestEmailHtml, adminEmailHtml };
