-- Add fullness surcharge columns to sheer_group_settings
ALTER TABLE "sheer_group_settings" ADD COLUMN IF NOT EXISTS "fullness_130_surcharge" DECIMAL(10,2) NOT NULL DEFAULT 15;
ALTER TABLE "sheer_group_settings" ADD COLUMN IF NOT EXISTS "fullness_140_surcharge" DECIMAL(10,2) NOT NULL DEFAULT 25;
ALTER TABLE "sheer_group_settings" ADD COLUMN IF NOT EXISTS "fullness_150_surcharge" DECIMAL(10,2) NOT NULL DEFAULT 45;
