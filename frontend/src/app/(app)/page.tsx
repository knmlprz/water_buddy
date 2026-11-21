import { SeasonScreen } from '@/screens/season'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mój sezon' }

export default function Page() {
  return <SeasonScreen />
}
