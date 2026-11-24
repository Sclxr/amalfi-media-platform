-- CreateTable
CREATE TABLE "ApiRateBucket" (
    "clientId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiRateBucket_pkey" PRIMARY KEY ("clientId","bucket")
);
