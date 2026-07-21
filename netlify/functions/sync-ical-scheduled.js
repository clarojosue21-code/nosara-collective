const { schedule } = require('@netlify/functions');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ICAL_FEEDS = {
  arcilla1:         ['https://www.airbnb.com/calendar/ical/1364560824324105727.ics?t=36ef19af5ed1411085c3ef4d85c0cac3',
                     'https://www.lodgify.com/85ad444d-9016-4fc2-a2fc-55bf1c6c6904.ics'],
  arcilla2:         ['https://www.airbnb.com/calendar/ical/1364560764925270828.ics?t=9d789399c92d4524a05e2acf1bb6bb29',
                     'https://www.lodgify.com/9fa0aae9-f360-4b4a-a575-3abad70be1ea.ics'],
  ojosazules:       ['https://www.airbnb.com/calendar/ical/754963035673300946.ics?t=22dc8b6d04e34ca0a78c1ee28c729f19',
                     'https://ical.booking.com/v1/export?t=455427e9-64bf-400d-9a1a-5d4a516b6090'],
  sol:              ['https://www.airbnb.com/calendar/ical/1076720749284905534.ics?t=69701c3ff73d47a69f4594ad8e1dd301'],
  mar:              ['https://www.airbnb.com/calendar/ical/1075348569613326856.ics?t=c902dda31cd34a35995f770e94af9958'],
  monkey:           ['https://www.airbnb.com/calendar/ical/32898115.ics?t=a9262281d6374e0f902ef7ff28c45701'],
  h7:               ['https://www.airbnb.com/calendar/ical/1340590425596595717.ics?t=a7ab7730fc8746ebbb8e20aef8ede4c3',
                     'https://ical.booking.com/v1/export?t=18f8b98a-56f9-4dd3-885e-b7926a50f733'],
  'sol-mar-bundle': ['https://www.airbnb.com/calendar/ical/1338591346598949808.ics?t=7c55ce1e08da47c79e2da8e87eb3c704'],
};

function parseIcal(text, propertyId) {
  const dates = [];
  const events = text.split('BEGIN:VEVENT');
  events.slice(1).forEach((ev) => {
    const dtstart = ev.match(/DTSTART[^:]*:(\d{8})/)?.[1];
    const dtend   = ev.match(/DTEND[^:]*:(\d{8})/)?.[1];
    if (dtstart && dtend) {
      let cur = new Date(parseInt(dtstart.slice(0,4)), parseInt(dtstart.slice(4,6))-1, parseInt(dtstart.slice(6,8)));
      const end = new Date(parseInt(dtend.slice(0,4)), parseInt(dtend.slice(4,6))-1, parseInt(dtend.slice(6,8)));
      while (cur < end) {
        dates.push({ property_id: propertyId, date: cur.toISOString().slice(0,10), source: 'ical' });
        cur = new Date(cur.getTime() + 86400000);
      }
    }
  });
  return dates;
}

async function syncProperty(propertyId, slug) {
  const urls = ICAL_FEEDS[slug];
  if (!urls?.length) return { slug, skipped: true };

  const allDates = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CalendarSync/1.0)', Accept: 'text/calendar' },
      });
      if (!res.ok) { console.warn(`iCal fetch failed: ${slug} ${res.status}`); continue; }
      allDates.push(...parseIcal(await res.text(), propertyId));
    } catch (e) {
      console.error(`iCal error: ${slug}`, e.message);
    }
  }

  const seen = new Set();
  const unique = allDates.filter(d => seen.has(d.date) ? false : seen.add(d.date));

  await supabase.from('blocked_dates').delete().eq('property_id', propertyId).eq('source', 'ical');
  if (unique.length > 0) {
    await supabase.from('blocked_dates').upsert(unique, { onConflict: 'property_id,date' });
  }

  console.log(`Synced ${slug}: ${unique.length} dates blocked`);
  return { slug, dates: unique.length };
}

const handler = async () => {
  console.log('Starting scheduled iCal sync —', new Date().toISOString());

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, slug');

  if (error || !properties?.length) {
    console.error('Failed to load properties:', error?.message);
    return { statusCode: 500, body: 'Failed to load properties' };
  }

  const results = await Promise.all(
    properties.map(p => syncProperty(p.id, p.slug))
  );

  console.log('Sync complete:', JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ synced: results }) };
};

// Runs every 12 hours (6am and 6pm Costa Rica time)
exports.handler = schedule('0 12,0 * * *', handler);
