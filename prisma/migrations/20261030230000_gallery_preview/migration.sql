-- Existing galleries stay valid. false means previews are not watermarked.
ALTER TABLE "Gallery" ADD COLUMN "previewWatermark" BOOLEAN NOT NULL DEFAULT false;
