-- AddColumn deletedAt to orders (soft delete / trash)
ALTER TABLE "orders" ADD COLUMN "deleted_at" TIMESTAMP(6);

-- AddColumn password reset fields to users
ALTER TABLE "users" ADD COLUMN "password_reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "password_reset_expires" TIMESTAMP(6);
