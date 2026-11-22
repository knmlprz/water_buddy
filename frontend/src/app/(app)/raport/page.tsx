import { RaportEkran } from '@/screens/raport-ekran'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Raport' }

export default function Page({
  searchParams,
}: {
  searchParams: { id?: string; uprawa?: string; data?: string }
}) {
  return <RaportEkran id={searchParams.id ?? ''} uprawa={searchParams.uprawa ?? ''} data={searchParams.data ?? ''} />
}
