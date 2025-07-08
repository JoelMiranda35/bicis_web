import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { lang = 'es' } = req.query;

  const validLangs = ['es', 'en', 'nl'];
  const language = validLangs.includes(lang) ? lang : 'es';

  const nameCol = `name_${language}`;

  try {
    const { data, error } = await supabase
      .from('accessories')
      .select(`id, ${nameCol} as name, type, price, available, created_at`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching accessories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
