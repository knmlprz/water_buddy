import { pobierzDzialke } from '@/lib/dzialka.mjs'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const lon = Number(url.searchParams.get('lon'))
  const lat = Number(url.searchParams.get('lat'))
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const dzialka = await pobierzDzialke({
      id: id || undefined,
      lon,
      lat,
      signal: ctrl.signal,
    })
    return NextResponse.json(dzialka)
  } catch (e) {
    const przerwane = e instanceof Error && e.name === 'AbortError'
    const blad = przerwane
      ? 'Serwer GUGiK nie odpowiada, spróbuj ponownie.'
      : e instanceof Error
        ? e.message
        : 'Nie udało się pobrać działki'
    return NextResponse.json({ blad }, { status: 404 })
  } finally {
    clearTimeout(timer)
  }
}
