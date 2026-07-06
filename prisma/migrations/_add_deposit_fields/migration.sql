-- AlterTable
ALTER TABLE "estimates" ADD COLUMN "depositAmount" DOUBLE PRECISION,
ADD COLUMN "depositPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "depositStripeSessionId" TEXT;
