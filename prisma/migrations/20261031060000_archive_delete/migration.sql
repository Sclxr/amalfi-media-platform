-- Hide-and-restore flag. Null means the record is on the normal lists.
ALTER TABLE "Property" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Brokerage" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ImportBatch" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Admins can permanently delete records that have no paid history. Staff cannot.
INSERT INTO "Permission" ("key", "description")
VALUES ('records.delete', 'Permanently delete records that have no financial history')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("role", "permissionKey")
VALUES ('ADMIN', 'records.delete')
ON CONFLICT ("role", "permissionKey") DO NOTHING;
