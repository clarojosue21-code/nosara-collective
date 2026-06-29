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
    .select('id, name, price_per_night')
    .eq(isUUID ? 'id' : 'slug', property_id)
    .single();

  if (propErr || !property) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Property not found' }) };
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

  const nights = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
  const accommodation_total = property.price_per_night * nights;
  const ncc_fee = Math.round(accommodation_total * 0.10);
  const subtotal = accommodation_total + ncc_fee;
  const taxes = Math.round(subtotal * 0.13);
  const grand_total = subtotal + taxes;
  const community_impact = Math.round(accommodation_total * 0.05);
  const owner_payout = accommodation_total;
  const company_allocation = Math.round(accommodation_total * 0.05);

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
      email: process.env.WISE_EMAIL || 'info@nosaracollective.com',
      amount: grand_total,
      currency: 'USD',
      reference,
      note: `Please include your booking reference ${reference} in the payment description`,
    };
    await supabase
      .from('reservations')
      .update({ payment_status: 'pending', wise_reference: reference })
      .eq('id', reservation.id);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  };
};
