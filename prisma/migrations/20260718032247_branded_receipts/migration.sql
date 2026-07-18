-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "receiptError" TEXT,
ADD COLUMN     "receiptSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "address" TEXT;
