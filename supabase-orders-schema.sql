-- ═══════════════════════════════════════════════════
-- NOSARA COLLECTIVE CONSCIENCE — Multi-item orders schema
-- Run this once in your Supabase SQL Editor
--
-- Replaces the one-property-per-booking "reservations" table with a proper
-- orders + order_items model, so a single checkout can include multiple
-- properties and/or concierge services and still be one atomic payment.
--
-- The old `reservations` and `concierge_requests` tables are left in place
-- (harmless, currently empty) but are no longer written to by the site.
-- ═══════════════════════════════════════════════════

-- One row per checkout: one guest, one payment, one or more items.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_country TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal','wise','bank_transfer')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','pending_bank_transfer','paid','cancelled','refunded')),
  paypal_order_id TEXT,
  wise_reference TEXT,
  grand_total INTEGER NOT NULL,
  taxes_total INTEGER NOT NULL,
  ncc_fee_total INTEGER NOT NULL,
  community_impact_total INTEGER NOT NULL,
  owner_payout_total INTEGER NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Each property stay or concierge service within an order.
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('property','service')),
  property_id UUID REFERENCES properties(id),
  name TEXT NOT NULL,
  check_in DATE,
  check_out DATE,
  nights INTEGER,
  num_guests INTEGER,
  price INTEGER NOT NULL,          -- final, all-inclusive line total
  owner_payout INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_property_id ON order_items(property_id);

-- blocked_dates now ties to the specific order_item (property stay) that
-- reserved it, alongside the legacy reservation_id column (unused going
-- forward, kept only so the existing column/FK isn't disturbed).
ALTER TABLE blocked_dates ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id);

-- RLS: same pattern as `reservations` — no public policies. Only the
-- Netlify functions (service role key) read/write these tables directly;
-- guest contact info should never be exposed to anon/public requests.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
