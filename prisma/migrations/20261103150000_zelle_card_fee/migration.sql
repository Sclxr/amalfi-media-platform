-- Card processing fee and Zelle collection. Existing orders stay unpaid with a zero fee.
CREATE TYPE "OrderCollection" AS ENUM ('UNPAID', 'AWAITING_ZELLE', 'PAID');

ALTER TABLE "Order" ADD COLUMN "cardFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "collection" "OrderCollection" NOT NULL DEFAULT 'UNPAID';

ALTER TABLE "Invoice" ADD COLUMN "cardFeeCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment" ADD COLUMN "baseCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "note" TEXT;
ALTER TABLE "Payment" ADD COLUMN "createdById" UUID;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
