const { finalizeOrder, supabase } = require('./_shared/finalize-order');

async function verifyPayPalWebhook(event) {
  // PayPal webhook signature verification
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return true; // skip in dev if not set

  const baseUrl =
    process.env.PAYPAL_MODE === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const { access_token } = await tokenRes.json();

  const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: event.headers['paypal-auth-algo'],
      cert_url: event.headers['paypal-cert-url'],
      client_id: process.env.PAYPAL_CLIENT_ID,
      transmission_id: event.headers['paypal-transmission-id'],
      transmission_sig: event.headers['paypal-transmission-sig'],
      transmission_time: event.headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(event.body),
    }),
  });

  const result = await verifyRes.json();
  return result.verification_status === 'SUCCESS';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const verified = await verifyPayPalWebhook(event);
  if (!verified) {
    console.error('PayPal webhook signature verification failed');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const eventType = payload.event_type;

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const orderId = payload.resource?.supplementary_data?.related_ids?.order_id
      || payload.resource?.id;
    const reference = payload.resource?.purchase_units?.[0]?.reference_id;

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .or(`paypal_order_id.eq.${orderId},reference.eq.${reference}`)
      .single();

    if (!order) {
      console.error('Order not found for PayPal order:', orderId);
      return { statusCode: 404, body: 'Order not found' };
    }

    // finalizeOrder is idempotent — safe even if the guest's browser already
    // triggered capture-paypal-order.js for the same order.
    await finalizeOrder(order);
  }

  return { statusCode: 200, body: 'OK' };
};
