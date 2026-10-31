-- Assign a CRM realtor to a property. Existing rows stay valid with a null lead.
ALTER TABLE "Property" ADD COLUMN "leadId" TEXT;

CREATE INDEX "Property_leadId_idx" ON "Property"("leadId");

ALTER TABLE "Property" ADD CONSTRAINT "Property_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- When a portal client already has a CRM lead, use that lead.
UPDATE "Property" AS p
SET "leadId" = l."id"
FROM "Lead" AS l
WHERE p."leadId" IS NULL
  AND l."clientId" = p."clientId";

-- Demo portal client Jordan Hale gets one CRM lead. No email is sent.
INSERT INTO "Lead" (
  "id",
  "firstName",
  "lastName",
  "email",
  "emailNormalized",
  "phone",
  "phoneE164",
  "status",
  "score",
  "tags",
  "city",
  "externalRef",
  "clientId",
  "convertedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed-lead-jordan-hale',
  c."firstName",
  c."lastName",
  c."email",
  lower(c."email"),
  c."phone",
  '+13215550108',
  'CONVERTED',
  0,
  ARRAY[]::TEXT[],
  'Orlando',
  'seed:jordan-hale',
  c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Client" AS c
INNER JOIN "user" AS u ON u."id" = c."userId"
WHERE u."email" = 'client.demo@amalfimedia.xyz'
  AND NOT EXISTS (
    SELECT 1
    FROM "Lead" AS existing
    WHERE existing."clientId" = c."id"
      OR existing."emailNormalized" = lower(c."email")
      OR existing."externalRef" = 'seed:jordan-hale'
  );

UPDATE "Lead" AS l
SET
  "clientId" = c."id",
  "convertedAt" = COALESCE(l."convertedAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Client" AS c
INNER JOIN "user" AS u ON u."id" = c."userId"
WHERE u."email" = 'client.demo@amalfimedia.xyz'
  AND l."emailNormalized" = lower(c."email")
  AND l."clientId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Lead" AS other WHERE other."clientId" = c."id" AND other."id" <> l."id"
  );

UPDATE "Property" AS p
SET "leadId" = l."id"
FROM "Lead" AS l
WHERE p."id" = 'seed-property-hale'
  AND p."leadId" IS NULL
  AND (
    l."externalRef" = 'seed:jordan-hale'
    OR l."clientId" = p."clientId"
  );
