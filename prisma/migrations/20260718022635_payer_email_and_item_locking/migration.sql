-- AlterTable
ALTER TABLE "line_items" ADD COLUMN     "paymentId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "payerEmail" TEXT;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
