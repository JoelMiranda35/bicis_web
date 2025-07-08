-- First, let's check if the column exists and add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accessories' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE accessories ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Update the Supabase schema cache by refreshing the table
COMMENT ON TABLE accessories IS 'Updated to include image_url column';
