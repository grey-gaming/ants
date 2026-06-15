import { type ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { MobileNav } from '@/components/ants/mobile-nav'

interface AppShellProps {
  children: ReactNode
  currentThreadName?: string
}

export function AppShell({ children, currentThreadName }: AppShellProps) {

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-0">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden md:block">
        <Sidebar />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — mobile only */}
        <Topbar currentThreadName={currentThreadName} />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-3 md:p-4 lg:p-6">
          {children}
        </main>

        {/* Bottom nav — mobile only */}
        <nav className="md:hidden">
          <MobileNav />
        </nav>
      </div>
    </div>
  )
}
