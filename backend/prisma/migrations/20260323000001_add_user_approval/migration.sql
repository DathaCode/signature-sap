-- AlterTable: add is_approved column to users
-- Default TRUE so all existing users remain approved
ALTER TABLE "users" ADD COLUMN "is_approved" BOOLEAN NOT NULL DEFAULT true;
