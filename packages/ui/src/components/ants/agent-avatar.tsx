import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type AgentTier = 't1' | 't2' | 't3'
type AgentStatus = 'idle' | 'running' | 'thinking' | 'tool_use' | 'complete' | 'error' | 'cancelled'
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

interface AgentAvatarProps {
  name: string
  tier: AgentTier
  status?: AgentStatus
  size?: AvatarSize
}

const tierColors: Record<AgentTier, string> = {
  t1: 'border-agent-t1',
  t2: 'border-agent-t2',
  t3: 'border-agent-t3',
}

const tierBgColors: Record<AgentTier, string> = {
  t1: 'bg-agent-t1/20',
  t2: 'bg-agent-t2/20',
  t3: 'bg-agent-t3/20',
}

const tierTextColors: Record<AgentTier, string> = {
  t1: 'text-agent-t1',
  t2: 'text-agent-t2',
  t3: 'text-agent-t3',
}

const sizes: Record<AvatarSize, { container: string; avatar: string; text: string; status: string }> = {
  xs: { container: 'h-4 w-4', avatar: 'h-4 w-4', text: 'text-[8px]', status: 'h-1.5 w-1.5' },
  sm: { container: 'h-6 w-6', avatar: 'h-6 w-6', text: 'text-[10px]', status: 'h-2 w-2' },
  md: { container: 'h-8 w-8', avatar: 'h-8 w-8', text: 'text-xs', status: 'h-2.5 w-2.5' },
  lg: { container: 'h-12 w-12', avatar: 'h-12 w-12', text: 'text-sm', status: 'h-3 w-3' },
}

export function AgentAvatar({ name, tier, status, size = 'md' }: AgentAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sizeConfig = sizes[size]

  return (
    <div className={cn('relative', sizeConfig.container)}>
      <Avatar className={cn(sizeConfig.avatar, 'border-2', tierColors[tier])}>
        <AvatarFallback className={cn(tierBgColors[tier], tierTextColors[tier])}>
          {initials}
        </AvatarFallback>
      </Avatar>
      {status && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface-0',
            sizeConfig.status,
            statusColor(status)
          )}
        />
      )}
    </div>
  )
}

function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'running':
    case 'tool_use':
      return 'bg-warning animate-pulse'
    case 'thinking':
      return 'bg-info animate-pulse'
    case 'complete':
      return 'bg-success'
    case 'error':
      return 'bg-error'
    case 'cancelled':
      return 'bg-warning'
    default:
      return 'bg-text-tertiary'
  }
}
