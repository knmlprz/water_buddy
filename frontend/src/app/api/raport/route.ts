import { zbudujRaport } from '@/lib/raport'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const raport = await zbudujRaport(body)
    return NextResponse.json(raport)
  } catch (e) {
    const blad = e instanceof Error ? e.message : 'Nie udało się policzyć raportu'
    const status = /działk|obrys|miejscu/i.test(blad) ? 404 : 400
    return NextResponse.json({ blad }, { status })
  }
}
