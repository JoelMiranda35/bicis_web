-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Create storage bucket for bike images (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bicis', 'bicis', true)
ON CONFLICT (id) DO NOTHING;

-- Set up more permissive storage policies for the bicis bucket
CREATE POLICY "Anyone can view bike images" ON storage.objects FOR SELECT 
USING (bucket_id = 'bicis');

CREATE POLICY "Anyone can upload bike images" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'bicis');

CREATE POLICY "Anyone can update bike images" ON storage.objects FOR UPDATE 
USING (bucket_id = 'bicis');

CREATE POLICY "Anyone can delete bike images" ON storage.objects FOR DELETE 
USING (bucket_id = 'bicis');
