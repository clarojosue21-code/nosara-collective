-- ═══════════════════════════════════════════════════
-- NOSARA COLLECTIVE CONSCIENCE — Pricing model update
-- Run this once in your Supabase SQL Editor
-- Adds seasonal pricing + per-person pricing (Castillo Colonial)
-- ═══════════════════════════════════════════════════

-- New columns (all additive, nothing destructive)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_payout_per_night INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS peak_price_per_night INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS peak_owner_payout_per_night INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pricing_unit TEXT DEFAULT 'per_night' CHECK (pricing_unit IN ('per_night','per_person'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS min_guests INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS min_nights INTEGER;

-- ═══════════════════════════════════════════════════
-- Final prices (regular / peak = Dec 21–Jan 6 + Mar 21–28)
-- All guest-facing prices are already all-inclusive —
-- owner payout + NCC margin + 13% tax are baked in, nothing
-- gets added on top at checkout.
-- ═══════════════════════════════════════════════════

UPDATE properties SET
  name = 'Clay House 1',
  price_per_night = 405,
  owner_payout_per_night = 304,
  peak_price_per_night = 600,
  peak_owner_payout_per_night = 450
WHERE slug = 'arcilla1';

UPDATE properties SET
  name = 'Clay House 2',
  price_per_night = 340,
  owner_payout_per_night = 255,
  peak_price_per_night = 550,
  peak_owner_payout_per_night = 413
WHERE slug = 'arcilla2';

UPDATE properties SET
  price_per_night = 625,
  owner_payout_per_night = 469,
  peak_price_per_night = 1050,
  peak_owner_payout_per_night = 788
WHERE slug = 'ojosazules';

UPDATE properties SET
  price_per_night = 235,
  owner_payout_per_night = 181,
  peak_price_per_night = 560,
  peak_owner_payout_per_night = 431
WHERE slug = 'mar';

UPDATE properties SET
  price_per_night = 235,
  owner_payout_per_night = 181,
  peak_price_per_night = 560,
  peak_owner_payout_per_night = 431
WHERE slug = 'sol';

UPDATE properties SET
  price_per_night = 300,
  owner_payout_per_night = 231,
  peak_price_per_night = 625,
  peak_owner_payout_per_night = 481
WHERE slug = 'h7';

UPDATE properties SET
  price_per_night = 235,
  owner_payout_per_night = 181,
  peak_price_per_night = 495,
  peak_owner_payout_per_night = 381
WHERE slug = 'monkey';

-- Castillo Colonial: per-person pricing, min 5 guests / 2 nights
UPDATE properties SET
  price_per_night = 125,
  owner_payout_per_night = 94,
  peak_price_per_night = 200,
  peak_owner_payout_per_night = 150,
  pricing_unit = 'per_person',
  min_guests = 5,
  min_nights = 2
WHERE slug = 'castillo';
