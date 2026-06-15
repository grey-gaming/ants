import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import { ChevronDown, ChevronRight, Clock } from 'lucide-react'

interface RunNode {
  id: string
  agentName: string
  agentTier: 't1' | 't2' | 't3'
  status: "idle" | "running" | "thinking" | "tool_use" | "complete" | "error" | "cancelled"
  duration: number
  children: RunNode[]
}

interface RunTreeProps {
  runs: RunNode[]
  onSelectRun?: (id: string) => void
  selectedRunId?: string
}

export function RunTree({ runs, onSelectRun, selectedRunId }: RunTreeProps) {
  return (
    <div className="space-y-1">
      {runs.map((run) => (
        <RunTreeNode
          key={run.id}
          node={run}
          depth={0}
          onSelectRun={onSelectRun}
          selectedRunId={selectedRunId}
        />
      ))}
    </div>
  )
}

function RunTreeNode({
  node,
  depth,
  onSelectRun,
  selectedRunId,
}: {
  node: RunNode
  depth: number
  onSelectRun?: (id: string) => void
  selectedRunId?: string
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = node.id === selectedRunId

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors cursor-pointer',
          isSelected && 'bg-surface-2'
        )}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded)
          onSelectRun?.(node.id)
        }}
      >
        {/* Expand/collapse chevron */}
        <span className="flex-shrink-0 text-text-tertiary">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </span>

        {/* Agent avatar */}
        <AgentAvatar
          name={node.agentName}
          tier={node.agentTier}
          status={node.status}
          size="xs"
        />

        {/* Agent name */}
        <span className="flex-1 truncate text-sm text-text-primary">
          {node.agentName}
        </span>

        {/* Duration */}
        <span className="flex items-center gap-1 text-xs text-text-tertiary">
          <Clock className="h-3 w-3" />
          {formatDuration(node.duration)}
        </span>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <RunTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelectRun={onSelectRun}
              selectedRunId={selectedRunId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}
