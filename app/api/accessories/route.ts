import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ⚠️ Solución clave: Fuerza a que la ruta sea dinámica (se ejecuta en cada request)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'es'

    const validLangs = ['es', 'en', 'nl']
    const language = validLangs.includes(lang) ? lang : 'es'

    const nameCol = `name_${language}`

    const { data, error } = await supabase
      .from('accessories')
      .select(`id, ${nameCol}, type, price, image_url, created_at`)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Mapeamos dinámicamente para enviar "name" como key estándar
    const mapped = data.map((a: any) => ({
      ...a,
      name: a[nameCol],
    }))

    return new Response(JSON.stringify(mapped), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    //console.error('Error fetching accessories:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}