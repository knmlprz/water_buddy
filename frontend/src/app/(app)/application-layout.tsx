'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const metodyka = pathname.startsWith('/metodyka')

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white print:hidden dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <NextLink href="/" className="text-sm font-semibold text-zinc-950 dark:text-white">
            Woda na działce
          </NextLink>
          <nav className="flex gap-4 text-sm">
            <NextLink href="/" className={pathname === '/' ? 'font-semibold' : 'text-zinc-600 dark:text-zinc-300'}>
              Start
            </NextLink>
            <NextLink href="/metodyka" className={metodyka ? 'font-semibold' : 'text-zinc-600 dark:text-zinc-300'}>
              Metodyka
            </NextLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
