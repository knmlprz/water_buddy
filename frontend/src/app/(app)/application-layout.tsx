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
import { MapIcon } from '@heroicons/react/20/solid'
import { usePathname } from 'next/navigation'

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  let pathname = usePathname()

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <span className="text-sm font-semibold text-zinc-950 dark:text-white">Woda na działce</span>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarItem href="/" current={pathname === '/'}>
              <Avatar initials="WD" className="bg-emerald-600 text-white" alt="Woda na działce" />
              <SidebarLabel>Woda na działce</SidebarLabel>
            </SidebarItem>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={pathname === '/'}>
                <MapIcon />
                <SidebarLabel>Woda na działce</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter>
            <div className="px-2">
              <Badge color="emerald">Liczone po pobraniu</Badge>
              <p className="mt-2 text-xs/5 text-zinc-500 dark:text-zinc-400">
                Numer działki albo puknięcie w mapę. Wynik powstaje z danych ściągniętych w tej chwili.
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
