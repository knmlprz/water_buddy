'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

const ROUTES = ['/', '/dlaczego', '/plan']

/** Strzałki zmieniają ekran, spacja na sezonie uruchamia odtwarzanie. */
export function SceneKeys() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && (el as HTMLInputElement).type !== 'range') {
        return
      }
      const k = Math.max(0, ROUTES.indexOf(pathname))
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        router.push(ROUTES[Math.min(ROUTES.length - 1, k + 1)])
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        router.push(ROUTES[Math.max(0, k - 1)])
      }
      if (e.key === '1') router.push(ROUTES[0])
      if (e.key === '2') router.push(ROUTES[1])
      if (e.key === '3') router.push(ROUTES[2])
      if (e.key === ' ' && pathname === '/') {
        e.preventDefault()
        window.dispatchEvent(new Event('fieldtwin-play'))
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [pathname, router])

  return null
}
