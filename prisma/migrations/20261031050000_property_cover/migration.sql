-- Optional staff-chosen cover. Existing listings keep a null and use the derived cover.
ALTER TABLE "Property" ADD COLUMN "coverAssetId" TEXT;

CREATE UNIQUE INDEX "Property_coverAssetId_key" ON "Property"("coverAssetId");

ALTER TABLE "Property" ADD CONSTRAINT "Property_coverAssetId_fkey"
  FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
