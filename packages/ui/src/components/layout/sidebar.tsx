import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  Pin,
  Loader2,
} from 'lucide-react'
import { useThreads, useCreateThread } from '@/hooks/api'

export function Sidebar() {
  const { isCollapsed, collapse, expand } = useSidebarStore()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ pinned: true, active: true })
  const navigate = useNavigate()
  const { data: threads, isLoading } = useThreads()
  const createThread = useCreateThread()

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleNewThread = () => {
    createThread.mutate(undefined, {
      onSuccess: (thread) => {
        navigate({ to: '/threads/$threadId', params: { threadId: thread.id } })
      },
    })
  }

  const pinnedThreads = threads?.filter((t) => t.isPinned) ?? []
  const activeThreads = threads?.filter((t) => !t.isPinned) ?? []

  return (
    <div className={cn('flex h-full flex-col border-r border-border bg-surface-1 transition-all duration-200', isCollapsed ? 'w-16' : 'w-64')}>
      <div className="flex h-16 items-center justify-between px-4">
        {!isCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">A</div>
            <span className="text-lg font-semibold text-text-primary">ANTS</span>
          </Link>
        )}
        {isCollapsed && <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">A</div>}
        <Button variant="ghost" size="icon" onClick={isCollapsed ? expand : collapse} className="h-8 w-8 text-text-secondary hover:text-text-primary">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      <Separator />

      <div className="p-3">
        <Button className={cn('w-full gap-2', isCollapsed && 'px-2')} onClick={handleNewThread} disabled={createThread.isPending}>
          {createThread.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {!isCollapsed && <span>New Thread</span>}
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <>
            <Collapsible open={openSections.pinned} onOpenChange={() => toggleSection('pinned')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className={cn('mb-1 w-full justify-start gap-2 px-2 text-text-secondary hover:text-text-primary', isCollapsed && 'px-1')}>
                  <Pin className="h-3.5 w-3.5" />
                  {!isCollapsed && <span className="text-xs font-medium">Pinned</span>}
                  <ChevronDown className="ml-auto h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {pinnedThreads.map((thread) => (
                  <SidebarThread key={thread.id} thread={thread} collapsed={isCollapsed} />
                ))}
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={openSections.active} onOpenChange={() => toggleSection('active')}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className={cn('mb-1 mt-2 w-full justify-start gap-2 px-2 text-text-secondary hover:text-text-primary', isCollapsed && 'px-1')}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  {!isCollapsed && <span className="text-xs font-medium">Active</span>}
                  <Badge variant="secondary" className="ml-auto h-5">{activeThreads.length}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {activeThreads.map((thread) => (
                  <SidebarThread key={thread.id} thread={thread} collapsed={isCollapsed} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </ScrollArea>

      <Separator />

      <nav className="p-3 space-y-1">
        <SidebarLink icon={LayoutDashboard} label="Dashboard" collapsed={isCollapsed} to="/" />
        <SidebarLink icon={Settings} label="Settings" collapsed={isCollapsed} to="/settings" />
      </nav>
    </div>
  )
}

function SidebarLink({ icon: Icon, label, collapsed, to }: { icon: React.ElementType; label: string; collapsed: boolean; to: string }) {
  return (
    <Link to={to}>
      <Button variant="ghost" className={cn('w-full justify-start gap-2 px-2 text-text-secondary hover:text-text-primary', collapsed && 'px-1')}>
        <Icon className="h-4 w-4" />
        {!collapsed && <span>{label}</span>}
      </Button>
    </Link>
  )
}

function SidebarThread({ thread, collapsed }: { thread: { id: string; title: string; lastMessageSnippet?: string; isPinned: boolean; activeRunId?: string }; collapsed: boolean }) {
  return (
    <Link to="/threads/$threadId" params={{ threadId: thread.id }}>
      <div className={cn('group mb-1 rounded-md px-3 py-2 transition-colors hover:bg-surface-2', thread.activeRunId && 'bg-surface-2')}>
        <div className="flex items-center gap-2">
          {thread.activeRunId && <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />}
          {!collapsed && <h3 className="flex-1 truncate text-sm font-medium text-text-primary">{thread.title}</h3>}
        </div>
        {!collapsed && thread.lastMessageSnippet && <p className="mt-1 truncate text-xs text-text-tertiary">{thread.lastMessageSnippet}</p>}
      </div>
    </Link>
  )
}
