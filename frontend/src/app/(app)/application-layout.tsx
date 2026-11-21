'use client'

import { Avatar } from '@/components/avatar'
import { Badge } from '@/components/badge'
import { Navbar, NavbarSection, NavbarSpacer } from '@/components/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/sidebar'
import { SidebarLayout } from '@/components/sidebar-layout'
import { CalendarDaysIcon, ChartBarIcon, MapIcon } from '@heroicons/react/20/solid'
import { usePathname } from 'next/navigation'

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  let pathname = usePathname()

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <span className="text-sm font-semibold text-zinc-950 dark:text-white">Field Twin</span>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarItem href="/" current={pathname === '/'}>
              <Avatar initials="FT" className="bg-emerald-600 text-white" alt="Field Twin" />
              <SidebarLabel>Field Twin</SidebarLabel>
            </SidebarItem>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={pathname === '/'}>
                <ChartBarIcon />
                <SidebarLabel>Mój sezon</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/dlaczego" current={pathname.startsWith('/dlaczego')}>
                <MapIcon />
                <SidebarLabel>Dlaczego to pole</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/plan" current={pathname.startsWith('/plan')}>
                <CalendarDaysIcon />
                <SidebarLabel>Mój płodozmian</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter>
            <div className="px-2">
              <Badge color="amber">Dane testowe</Badge>
              <p className="mt-2 text-xs/5 text-zinc-500 dark:text-zinc-400">
                Podmień pliki w src/data. Strzałki zmieniają ekran, spacja odtwarza sezon.
              </p>
            </div>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  )
}
