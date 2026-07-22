const { createClient } = require('@supabase/supabase-js');
const { sendOrderConfirmation } = require('./order-email');
const { BUNDLE_COMPONENTS } = require('./bundles');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Marks an order paid, blocks all property dates, and sends the confirmation
// email — exactly once. Both the PayPal capture callback (guest redirected
// back to the site) and the PayPal webhook (server-to-server, may fire
// independently) call this with the same order — whichever runs first wins
// the race via the conditional update below; the other sees `alreadyProcessed`
// and does nothing further, so a guest is never double-emailed.
async function finalizeOrder(order) {
  if (order.payment_status === 'paid') {
    return { alreadyProcessed: true };
  }

  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('payment_status', order.payment_status)
    .select()
    .single();

  if (updateErr || !updated) {
    return { alreadyProcessed: true };
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);

  const propertyItems = (items || []).filter((i) => i.item_type === 'property');

  // Resolve each property's slug so bundle bookings also block their
  // component houses' own calendars (and vice versa is already covered at
  // create-reservation.js time by rejecting overlapping availability).
  const propertyIds = [...new Set(propertyItems.map((i) => i.property_id))];
  const { data: propRows } = propertyIds.length
    ? await supabase.from('properties').select('id, slug').in('id', propertyIds)
    : { data: [] };
  const slugById = {};
  (propRows || []).forEach((p) => { slugById[p.id] = p.slug; });

  let componentSlugsToIds = {};
  const allComponentSlugs = [...new Set(
    propertyItems.flatMap((i) => BUNDLE_COMPONENTS[slugById[i.property_id]] || [])
  )];
  if (allComponentSlugs.length) {
    const { data: componentRows } = await supabase.from('properties').select('id, slug').in('slug', allComponentSlugs);
    (componentRows || []).forEach((p) => { componentSlugsToIds[p.slug] = p.id; });
  }

  const dateRows = [];
  for (const item of propertyItems) {
    const slug = slugById[item.property_id];
    const componentIds = (BUNDLE_COMPONENTS[slug] || []).map((s) => componentSlugsToIds[s]).filter(Boolean);
    const targetIds = [item.property_id, ...componentIds];
    let cur = new Date(item.check_in);
    const end = new Date(item.check_out);
    while (cur < end) {
      const dateStr = cur.toISOString().slice(0, 10);
      for (const pid of targetIds) {
        dateRows.push({ property_id: pid, date: dateStr, source: 'order', order_item_id: item.id });
      }
      cur = new Date(cur.getTime() + 86400000);
    }
  }
  if (dateRows.length > 0) {
    await supabase.from('blocked_dates').upsert(dateRows, { onConflict: 'property_id,date' });
  }

  // The booking itself is already final at this point (paid + dates
  // blocked). A confirmation-email failure (bad address, Resend outage,
  // etc.) must never bubble up as an overall failure — the guest already
  // paid successfully and should see success, not an error screen. Log it
  // for follow-up instead; a confirmation can be re-sent manually via
  // send-confirmation.js.
  let emailError = null;
  try {
    await sendOrderConfirmation(updated, items || []);
  } catch (e) {
    console.error(`Confirmation email failed for order ${updated.reference}:`, e.message);
    emailError = e.message;
  }
  return { alreadyProcessed: false, emailError };
}

module.exports = { finalizeOrder, supabase };
