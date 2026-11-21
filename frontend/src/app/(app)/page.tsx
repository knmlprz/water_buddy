import { WodaScreen } from '@/screens/woda'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Woda na działce' }

export default function Page() {
  return <WodaScreen />
}
