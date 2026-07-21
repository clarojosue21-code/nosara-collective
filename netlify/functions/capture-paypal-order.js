const { finalizeOrder, supabase } = require('./_shared/finalize-order');

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

    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('*')
      .eq('reference', reference)
      .single();

    if (findErr || !order) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found', detail: findErr?.message }) };
    }

    await finalizeOrder(order);

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
