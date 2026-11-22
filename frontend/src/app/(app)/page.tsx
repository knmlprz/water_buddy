import { StartScreen } from '@/screens/start'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Start' }

export default function Page() {
  return <StartScreen />
}
