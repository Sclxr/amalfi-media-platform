-- Campaign.segment is optional. Existing campaigns stay drafts with a null segment.
ALTER TABLE "Campaign" ADD COLUMN "segment" JSONB;
