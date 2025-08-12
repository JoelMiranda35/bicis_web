import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'es';

    const validLangs = ['es', 'en', 'nl'];
    const language = validLangs.includes(lang) ? lang : 'es';

    const titleCol = `title_${language}`;
    const subtitleCol = `subtitle_${language}`;

    const selectFields = [
      'id',
      titleCol,
      subtitleCol,
      'category',
      'size',
      'available',
      'image_url',
      'created_at'
    ].join(', ');

    const { data, error } = await supabase
      .from('bikes')
      .select(selectFields)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    //console.error('Error fetching bikes:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
