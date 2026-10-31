-- Single-use listing invites. The raw token is never stored.
CREATE TABLE "ListingInvite" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingInvite_tokenHash_key" ON "ListingInvite"("tokenHash");
CREATE INDEX "ListingInvite_propertyId_expiresAt_idx" ON "ListingInvite"("propertyId", "expiresAt");
CREATE INDEX "ListingInvite_clientId_idx" ON "ListingInvite"("clientId");

ALTER TABLE "ListingInvite" ADD CONSTRAINT "ListingInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInvite" ADD CONSTRAINT "ListingInvite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInvite" ADD CONSTRAINT "ListingInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Safe: client emails are already unique when compared case-insensitively.
CREATE UNIQUE INDEX "Client_email_lower_key" ON "Client" (lower("email"));
