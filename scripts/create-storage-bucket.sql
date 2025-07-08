-- Create storage bucket for bike images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bicis', 'bicis', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the bicis bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'bicis');

CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'bicis' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update" ON storage.objects FOR UPDATE 
USING (bucket_id = 'bicis' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete" ON storage.objects FOR DELETE 
USING (bucket_id = 'bicis' AND auth.role() = 'authenticated');
