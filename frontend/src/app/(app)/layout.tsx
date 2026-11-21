import { ApplicationLayout } from './application-layout'
import { SceneKeys } from './scene-keys'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationLayout>
      <SceneKeys />
      {children}
    </ApplicationLayout>
  )
}
