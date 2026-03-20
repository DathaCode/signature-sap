-- AddColumn: user discounts (JSON blob for per-group Acmeda/TBS discounts)
ALTER TABLE "users" ADD COLUMN "discounts" JSONB;
