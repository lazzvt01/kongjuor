import { Outlet } from 'react-router-dom'

import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { InstallAppBanner } from '@/components/shared/InstallAppBanner'

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileHeader />
      <main className="pb-24 lg:ml-64 lg:pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4 lg:max-w-5xl lg:px-8 lg:pt-8">
          <InstallAppBanner />
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
