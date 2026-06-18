-- ═══════════════════════════════════════════════════
-- NOSARA COLLECTIVE CONSCIENCE — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_per_night INTEGER NOT NULL,
  max_guests INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  description TEXT,
  cover_image TEXT,
  images JSONB,
  features JSONB,
  airbnb_ical_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  property_id UUID REFERENCES properties(id),
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_country TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL,
  num_guests INTEGER NOT NULL,
  accommodation_total INTEGER NOT NULL,
  taxes INTEGER NOT NULL,
  grand_total INTEGER NOT NULL,
  community_impact INTEGER NOT NULL,
  owner_payout INTEGER NOT NULL,
  company_allocation INTEGER NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('paypal','wise')),
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','verified','cancelled','refunded')),
  paypal_order_id TEXT,
  wise_reference TEXT,
  wise_proof_url TEXT,
  services JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked Dates (from Airbnb iCal + confirmed reservations)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  date DATE NOT NULL,
  source TEXT DEFAULT 'manual',
  reservation_id UUID REFERENCES reservations(id),
  UNIQUE(property_id, date)
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('booking','retreat','real_estate','concierge','general')),
  name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  message TEXT,
  property_interest TEXT,
  budget TEXT,
  travel_dates TEXT,
  num_guests INTEGER,
  source TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Concierge Requests
CREATE TABLE IF NOT EXISTS concierge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id),
  guest_name TEXT,
  guest_email TEXT,
  services JSONB NOT NULL,
  total INTEGER,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- SEED: Properties
-- ═══════════════════════════════════════════════════

INSERT INTO properties (slug, name, price_per_night, max_guests, bedrooms, bathrooms, description, cover_image, images, features, airbnb_ical_url, is_active) VALUES

('arcilla1', 'Casa Arcilla No. 1', 500, 8, 3, 3,
 'A stunning clay-earth villa set among tropical gardens with a private infinity pool overlooking the Nosara jungle. Modern luxury meets Guanacaste tradition.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["Private infinity pool","3 bed / 3 bath","Fully equipped kitchen","Air conditioning","Fast WiFi","Daily housekeeping","Garden terrace","Jungle views"]',
 'https://www.airbnb.com/calendar/ical/1364560824324105727.ics?t=36ef19af5ed1411085c3ef4d85c0cac3',
 true),

('arcilla2', 'Casa Arcilla No. 2', 450, 6, 3, 2,
 'Sister villa to Casa Arcilla No. 1, sharing the same lush grounds. Perfect for groups booking both villas together.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["Private pool access","3 bed / 2 bath","Shared grounds with Arcilla 1","Air conditioning","Fast WiFi","Tropical garden"]',
 'https://www.airbnb.com/calendar/ical/1364560764925270828.ics?t=9d789399c92d4524a05e2acf1bb6bb29',
 true),

('arcilla-bundle', 'Bundle: Arcilla 1 + 2', 900, 14, 6, 5,
 'Book both Casa Arcilla villas and create an exclusive compound for up to 14 guests. Ideal for family reunions, yoga retreats, or large group escapes.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["Both villas (6 bed / 5 bath)","Two private pools","Up to 14 guests","Exclusive compound","Full kitchen x2","Daily housekeeping"]',
 NULL,
 true),

('ojosazules', 'Casa Ojos Azules', 500, 8, 3, 3,
 'A serene blue-eyed villa surrounded by swaying palms and birdsong. Features a private pool and open-air living areas that blend indoor and outdoor living.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["Private pool","3 bed / 3 bath","Open-air living","Hammock terrace","Air conditioning","Fast WiFi","Minutes to beach"]',
 'https://www.airbnb.com/calendar/ical/754963035673300946.ics?t=22dc8b6d04e34ca0a78c1ee28c729f19',
 true),

('sol', 'Casa Sol', 300, 6, 2, 2,
 'A bright, sun-soaked retreat with warm interiors and a lush garden. Perfect for couples or small families seeking the Nosara lifestyle.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["2 bed / 2 bath","Tropical garden","Air conditioning","WiFi","Outdoor terrace","Quiet neighborhood"]',
 'https://www.airbnb.com/calendar/ical/1076720749284905534.ics?t=69701c3ff73d47a69f4594ad8e1dd301',
 true),

('mar', 'Casa Mar', 300, 6, 2, 2,
 'Feel the ocean breeze from this coastal-inspired home. Light, airy interiors and proximity to Playa Guiones make Casa Mar a surf lover''s dream.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["2 bed / 2 bath","Near Playa Guiones","Air conditioning","WiFi","Outdoor shower","Surf board storage"]',
 'https://www.airbnb.com/calendar/ical/1075348569613326856.ics?t=c902dda31cd34a35995f770e94af9958',
 true),

('sol-mar-bundle', 'Bundle: Sol + Mar', 560, 12, 4, 4,
 'Two charming homes, one great price. Perfect for extended families or friend groups wanting private spaces with shared adventure.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["Both casas (4 bed / 4 bath)","Up to 12 guests","Two kitchens","Separate entrances","Air conditioning","Great value"]',
 NULL,
 true),

('monkey', 'Casa Monkey', 200, 4, 2, 1,
 'A charming jungle hideaway where howler monkeys are your morning alarm. Budget-friendly without sacrificing the Nosara magic.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["2 bed / 1 bath","Jungle setting","Monkeys nearby","WiFi","Air conditioning","Best value in Nosara"]',
 'https://www.airbnb.com/calendar/ical/32898115.ics?t=a9262281d6374e0f902ef7ff28c45701',
 true),

('h7', 'H7 Highlands', 300, 6, 3, 2,
 'Perched in the highlands above Nosara with panoramic valley views. A unique architectural gem offering cool breezes and total tranquility.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["3 bed / 2 bath","Panoramic valley views","Cool highland breeze","Unique architecture","Fast WiFi","Air conditioning"]',
 'https://www.airbnb.com/calendar/ical/1340590425596595717.ics?t=a7ab7730fc8746ebbb8e20aef8ede4c3',
 true),

('castillo', 'Castillo Colonial', 0, 20, 8, 6,
 'An extraordinary colonial castle estate unlike anything else in Costa Rica. Multiple living areas, event spaces, and grounds for up to 20 guests. Pricing on inquiry.',
 'https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg',
 '["https://res.cloudinary.com/dzqgajn3l/image/upload/v1780975891/1_-_grounds5_qacxew.jpg"]',
 '["8 bed / 6 bath","Colonial architecture","Event spaces","Up to 20 guests","Full staff available","Exclusive estate","Contact for pricing"]',
 NULL,
 true)

ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_requests ENABLE ROW LEVEL SECURITY;

-- Public can read active properties
DROP POLICY IF EXISTS "Public read properties" ON properties;
CREATE POLICY "Public read properties" ON properties
  FOR SELECT USING (is_active = true);

-- Public can read blocked dates (for calendar availability)
DROP POLICY IF EXISTS "Public read blocked_dates" ON blocked_dates;
CREATE POLICY "Public read blocked_dates" ON blocked_dates
  FOR SELECT USING (true);

-- Service role bypass for functions (already handled by service role key)
-- All writes go through Netlify functions using service_role key, so no insert policies needed for anon
