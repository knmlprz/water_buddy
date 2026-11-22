import { zbudujRaport } from '@/lib/raport'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const lon = Number(url.searchParams.get('lon'))
  const lat = Number(url.searchParams.get('lat'))
  try {
    const raport = await zbudujRaport({
      id: url.searchParams.get('id') || undefined,
      uprawa: url.searchParams.get('uprawa') || undefined,
      data: url.searchParams.get('data') || undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
    })
    return NextResponse.json(raport)
  } catch (e) {
    const blad = e instanceof Error ? e.message : 'Nie udało się policzyć raportu'
    const status = /działk|obrys|miejscu|GUGiK/i.test(blad) ? 404 : 400
    return NextResponse.json({ blad }, { status })
  }
}
