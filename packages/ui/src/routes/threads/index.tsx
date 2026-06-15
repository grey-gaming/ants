import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThreadCard } from '@/components/ants/thread-card'
import {
  Plus,
  Search,
  Filter,
  Pin,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { useThreads, useCreateThread } from '@/hooks/api'

export function ThreadsPage() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { data: threads, isLoading } = useThreads()
  const createThread = useCreateThread()

  const handleNewThread = () => {
    createThread.mutate(undefined, {
      onSuccess: (thread) => {
        navigate({ to: '/threads/$threadId', params: { threadId: thread.id } })
      },
    })
  }

  const allThreads = threads ?? []
  const filteredThreads = allThreads.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  const pinned = filteredThreads.filter((thread) => thread.isPinned)
  const active = filteredThreads.filter((thread) => !thread.isPinned)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-heading-lg text-text-primary">Threads</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" onClick={handleNewThread} disabled={createThread.isPending}>
            {createThread.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New Thread
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          placeholder="Search threads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {/* Pinned threads */}
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-heading-sm text-text-secondary">
                <Pin className="h-3.5 w-3.5" />
                Pinned
              </h2>
              <div className="space-y-2">
                {pinned.map((thread) => (
                  <Link key={thread.id} to="/threads/$threadId" params={{ threadId: thread.id }}>
                    <ThreadCard thread={{
                      id: thread.id,
                      title: thread.title,
                      lastMessage: thread.lastMessageSnippet,
                      updatedAt: thread.updatedAt,
                      runCount: thread.runCount,
                      isPinned: thread.isPinned,
                      isActive: !!thread.activeRunId,
                    }} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Active threads */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-heading-sm text-text-secondary">
              <MessageSquare className="h-3.5 w-3.5" />
              Recent
            </h2>
            {active.length === 0 && pinned.length === 0 && (
              <p className="text-sm text-text-tertiary">No threads yet. Create one to get started.</p>
            )}
            <div className="space-y-2">
              {active.map((thread) => (
                <Link key={thread.id} to="/threads/$threadId" params={{ threadId: thread.id }}>
                  <ThreadCard thread={{
                    id: thread.id,
                    title: thread.title,
                    lastMessage: thread.lastMessageSnippet,
                    updatedAt: thread.updatedAt,
                    runCount: thread.runCount,
                    isPinned: thread.isPinned,
                    isActive: !!thread.activeRunId,
                  }} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
