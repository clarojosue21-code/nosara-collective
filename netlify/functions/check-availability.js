const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ICAL_FEEDS = {
  arcilla1: 'https://www.airbnb.com/calendar/ical/1364560824324105727.ics?t=36ef19af5ed1411085c3ef4d85c0cac3',
  arcilla2: 'https://www.airbnb.com/calendar/ical/1364560764925270828.ics?t=9d789399c92d4524a05e2acf1bb6bb29',
  ojosazules: 'https://www.airbnb.com/calendar/ical/754963035673300946.ics?t=22dc8b6d04e34ca0a78c1ee28c729f19',
  sol: 'https://www.airbnb.com/calendar/ical/1076720749284905534.ics?t=69701c3ff73d47a69f4594ad8e1dd301',
  mar: 'https://www.airbnb.com/calendar/ical/1075348569613326856.ics?t=c902dda31cd34a35995f770e94af9958',
  monkey: 'https://www.airbnb.com/calendar/ical/32898115.ics?t=a9262281d6374e0f902ef7ff28c45701',
  h7: 'https://www.airbnb.com/calendar/ical/1340590425596595717.ics?t=a7ab7730fc8746ebbb8e20aef8ede4c3',
};

function parseIcal(text, propertyId) {
  const dates = [];
  const events = text.split('BEGIN:VEVENT');
  events.slice(1).forEach((ev) => {
    const dtstart = ev.match(/DTSTART[^:]*:(\d{8})/)?.[1];
    const dtend = ev.match(/DTEND[^:]*:(\d{8})/)?.[1];
    if (dtstart && dtend) {
      let cur = new Date(
        parseInt(dtstart.slice(0, 4)),
        parseInt(dtstart.slice(4, 6)) - 1,
        parseInt(dtstart.slice(6, 8))
      );
      const end = new Date(
        parseInt(dtend.slice(0, 4)),
        parseInt(dtend.slice(4, 6)) - 1,
        parseInt(dtend.slice(6, 8))
      );
      while (cur < end) {
        const dateStr = cur.toISOString().slice(0, 10);
        dates.push({ property_id: propertyId, date: dateStr, source: 'airbnb' });
        cur = new Date(cur.getTime() + 86400000);
      }
    }
  });
  return dates;
}

async function syncIcal(propertyId, slug) {
  const url = ICAL_FEEDS[slug];
  if (!url) return;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'NosarCollective/1.0' } });
    if (!res.ok) return;
    const text = await res.text();
    const dates = parseIcal(text, propertyId);

    if (dates.length > 0) {
      // Remove old airbnb-sourced dates for this property, then re-insert
      await supabase
        .from('blocked_dates')
        .delete()
        .eq('property_id', propertyId)
        .eq('source', 'airbnb');

      await supabase.from('blocked_dates').upsert(dates, { onConflict: 'property_id,date' });
    }
  } catch (e) {
    console.warn('iCal sync failed for', slug, e.message);
  }
}

exports.handler = async (event) => {
  const { property_id, check_in, check_out } = event.queryStringParameters || {};

  if (!property_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'property_id required' }) };
  }

  // Get property slug to look up iCal
  const { data: property } = await supabase
    .from('properties')
    .select('id, slug')
    .eq('id', property_id)
    .single();

  if (property) {
    await syncIcal(property.id, property.slug);
  }

  // Fetch blocked dates for response
  const query = supabase
    .from('blocked_dates')
    .select('date')
    .eq('property_id', property_id);

  if (check_in && check_out) {
    query.gte('date', check_in).lt('date', check_out);
  } else {
    // Return next 6 months
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    query.gte('date', from).lte('date', to);
  }

  const { data: blocked } = await query;
  const blockedDates = (blocked || []).map((b) => b.date);

  let available = true;
  if (check_in && check_out) {
    available = blockedDates.length === 0;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ available, blocked_dates: blockedDates }),
  };
};
