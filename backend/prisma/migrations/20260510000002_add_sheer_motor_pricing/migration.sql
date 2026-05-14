-- Widen charger_hub to TEXT to store JSON array of multiple selections
ALTER TABLE "order_items" ALTER COLUMN "charger_hub" TYPE TEXT;

-- Motor pricing by width range for sheer curtain motors
CREATE TABLE "sheer_motor_pricing" (
    "id"         SERIAL PRIMARY KEY,
    "motor_type" VARCHAR(20) NOT NULL,
    "width_from" INTEGER NOT NULL,
    "width_to"   INTEGER NOT NULL,
    "price"      DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "sheer_motor_pricing_motor_type_width_from_key" UNIQUE ("motor_type", "width_from")
);
