const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Bad Request' }; }

  const { email, phone, type, source } = body;
  if (!email && !phone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email or phone required' }) };
  }

  // Save to Supabase leads table
  const { error: dbError } = await supabase.from('leads').insert([{
    email: email || null,
    phone: phone || null,
    type: type || 'general',
    source: source || 'guide-cta',
    created_at: new Date().toISOString(),
  }]);

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    // Still return success to the user — don't block on DB errors
  }

  // Send email notification via Resend (free tier — 3,000 emails/month)
  // Requires RESEND_API_KEY env var in Netlify dashboard
  if (process.env.RESEND_API_KEY) {
    const typeLabel = type === 'property' ? 'Buying Property' : type === 'relocation' ? 'Moving to CR' : 'General';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'leads@nosaracollectiveconscience.com',
          to: ['clarojosue21@gmail.com'],
          subject: `New Lead — ${typeLabel} | Nosara Collective`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#C4784A;margin-bottom:4px">New Lead — ${typeLabel}</h2>
              <p style="color:#888;font-size:12px;margin-top:0">Via The Collective Guide</p>
              <table style="border-collapse:collapse;width:100%;margin-top:16px">
                <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:90px">Email</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px">${email || '—'}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Phone</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px">${phone || '—'}</td></tr>
                <tr><td style="padding:8px 0;color:#888;font-size:13px">Interest</td>
                    <td style="padding:8px 0;font-size:13px">${typeLabel}</td></tr>
              </table>
              <p style="margin-top:24px;font-size:12px;color:#aaa">Nosara Collective Conscience · nosaracollectiveconscience.com</p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error('Resend error:', e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
