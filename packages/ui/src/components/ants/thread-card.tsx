import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { Pin, MessageSquare } from 'lucide-react'

interface ThreadCardProps {
  thread: {
    id: string
    title: string
    lastMessage?: string
    updatedAt: string
    runCount: number
    isPinned: boolean
    isActive: boolean
  }
}

export function ThreadCard({ thread }: ThreadCardProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-2',
        thread.isActive && 'border-accent/50'
      )}
    >
      {/* Status indicator */}
      <div className="mt-1">
        {thread.isActive ? (
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-text-tertiary" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {thread.isPinned && <Pin className="h-3 w-3 text-text-tertiary" />}
          <h3 className="truncate text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
            {thread.title}
          </h3>
        </div>
        {thread.lastMessage && (
          <p className="mt-1 truncate text-xs text-text-tertiary">{thread.lastMessage}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
          <span>{formatDate(thread.updatedAt)}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {thread.runCount} runs
          </span>
        </div>
      </div>
    </div>
  )
}
