-- Add PLU column to products table
ALTER TABLE "public"."products" ADD COLUMN "plu" text;

-- Add comment
COMMENT ON COLUMN "public"."products"."plu" IS 'Price Look-Up code for fruits/vegetables (4-5 digits)';

-- Create index for faster lookups
CREATE INDEX "products_plu_idx" ON "public"."products" ("plu");
