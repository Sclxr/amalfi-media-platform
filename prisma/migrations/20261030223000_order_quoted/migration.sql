-- QUOTED is new. Existing statuses and rows stay valid. The value is not used in this migration.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'QUOTED' BEFORE 'CONFIRMED';

INSERT INTO "EmailTemplate" ("id", "key", "category", "subject", "bodyMjml", "updatedAt")
VALUES
  (
    'seed-booking-received',
    'booking-received',
    'TRANSACTIONAL',
    'We received your booking request',
    'Amalfi Media received a shoot request for {{address}} in Orlando, FL. This note is a preview until transactional email is enabled in production.',
    CURRENT_TIMESTAMP
  ),
  (
    'seed-quote-ready',
    'quote-ready',
    'TRANSACTIONAL',
    'Your Amalfi Media quote',
    'A quote is ready for {{address}}. Drone and video items are priced individually. This note is a preview until transactional email is enabled in production.',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;
