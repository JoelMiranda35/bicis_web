-- Add image_url column to accessories table
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update existing accessories with placeholder or null values
UPDATE accessories SET image_url = NULL WHERE image_url IS NULL;
