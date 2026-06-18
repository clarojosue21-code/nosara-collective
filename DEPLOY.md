# Deploy Checklist

## Step 1 — Run the Supabase schema (5 min)

1. Go to https://supabase.com/dashboard/project/gvslmjrwgfdbymmrbcur
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `supabase-schema.sql`
4. Click **Run**
5. You should see 5 tables created + 10 properties seeded

Verify in **Table Editor** → `properties` should show 10 rows.

---

## Step 2 — Push to GitHub (5 min)

Open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "Phase 1: NCC booking platform"
```

Then create a repo at github.com and run:
```bash
git remote add origin https://github.com/YOUR_USERNAME/nosara-collective.git
git push -u origin main
```

---

## Step 3 — Deploy to Netlify (5 min)

1. Go to https://app.netlify.com → **Add new site → Import from Git**
2. Choose your GitHub repo
3. Build settings:
   - **Build command:** `npm install`
   - **Publish directory:** `.`
4. Click **Deploy site**

---

## Step 4 — Add Environment Variables in Netlify

**Site settings → Environment variables → Add a variable**

Paste each one exactly:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://gvslmjrwgfdbymmrbcur.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2xtanJ3Z2ZkYnltbXJiY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3Mjk4NDYsImV4cCI6MjA5NzMwNTg0Nn0.4cqzx-9dGdYxn7jVUDpuZBb-mbePQu1WnJy1h-LJv_I` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2xtanJ3Z2ZkYnltbXJiY3VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTcyOTg0NiwiZXhwIjoyMDk3MzA1ODQ2fQ.jYnopXllcXeGTvyxMPsBgMmm8hfm2LamiNOcgAe__zU` |
| `RESEND_API_KEY` | `re_6QkkkfUx_Dc8dF5vZVnB14XoqnzAixMFG` |
| `WISE_ACCOUNT_NAME` | `Nosara Collective Conscience` |
| `WISE_EMAIL` | `info@nosaracollective.com` |
| `ADMIN_EMAIL` | `info@nosaracollective.com` |
| `ADMIN_WHATSAPP` | `+50612345678` |
| `PAYPAL_MODE` | `sandbox` |
| `SITE_URL` | `https://YOUR-SITE-NAME.netlify.app` ← update after deploy |

After adding PayPal (later):
| `PAYPAL_CLIENT_ID` | from developer.paypal.com |
| `PAYPAL_CLIENT_SECRET` | from developer.paypal.com |
| `PAYPAL_WEBHOOK_ID` | from PayPal webhook setup |

---

## Step 5 — Trigger redeploy

After adding env vars: **Deploys → Trigger deploy → Deploy site**

---

## Step 6 — Test end-to-end

1. Open your Netlify URL
2. Click **Casa Arcilla No. 1** → Gallery opens
3. Select dates (check calendar shows Airbnb blocked dates)
4. Fill in name + email
5. Select **Wise** (works without PayPal keys)
6. Click **Reserve Now**
7. You should see Wise payment instructions modal with your reference code
8. Check Supabase → **Table Editor → reservations** → should show 1 row
9. Check your email (admin notification sent to info@nosaracollective.com)

---

## Email domain (Resend)

Currently emails send from `onboarding@resend.dev` (Resend's free test domain).

To send from `bookings@nosaracollective.com`:
1. Go to https://resend.com/domains
2. Add `nosaracollective.com`
3. Add the DNS TXT + MX records they give you
4. Once verified, update line in `netlify/functions/send-confirmation.js`:
   ```
   from: 'Nosara Collective <bookings@nosaracollective.com>',
   ```

---

## Supabase key clarification

Supabase recently introduced a new "publishable key" format (`sb_publishable_*`).
This project uses the **classic JWT format** which works with `@supabase/supabase-js` v2.
The publishable key (`sb_publishable_haOmTm-VndPJDqDWugJi9Q_Kjv7Tto9`) is NOT the URL —
the URL is always `https://[project-ref].supabase.co`.
