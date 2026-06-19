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
  const { access_token } = await res.json();
  return { access_token, baseUrl };
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

    // Capture the order
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const capture = await captureRes.json();

    if (capture.status !== 'COMPLETED') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Payment not completed', status: capture.status }) };
    }

    // Update reservation status
    const { data: reservation } = await supabase
      .from('reservations')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('reference', reference)
      .select()
      .single();

    if (reservation) {
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

      // Send confirmation email
      const apiBase = process.env.SITE_URL || 'https://nosara-collective.netlify.app';
      await fetch(`${apiBase}/.netlify/functions/send-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservation.id }),
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, reference }),
    };
  } catch (e) {
    console.error('Capture error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Capture failed' }) };
  }
};
