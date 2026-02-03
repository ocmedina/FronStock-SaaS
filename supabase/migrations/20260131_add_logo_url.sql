-- Add logo_url column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_url TEXT;
