// Manual/administrative re-send of an order confirmation email. Not part of
// the normal payment flow (that goes through _shared/finalize-order.js,
// triggered by capture-paypal-order.js or paypal-webhook.js) — this exists
// only for re-sending a confirmation on request, e.g. if a guest says they
// never received it.
const { createClient } = require('@supabase/supabase-js');
const { sendOrderConfirmation } = require('./_shared/order-email');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  const { order_id, reference } = body;
  if (!order_id && !reference) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id or reference required' }) };
  }

  const query = supabase.from('orders').select('*');
  const { data: order, error } = order_id
    ? await query.eq('id', order_id).single()
    : await query.eq('reference', reference).single();

  if (error || !order) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  try {
    await sendOrderConfirmation(order, items || []);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (e) {
    console.error('Resend confirmation error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send confirmation', detail: e.message }) };
  }
};
