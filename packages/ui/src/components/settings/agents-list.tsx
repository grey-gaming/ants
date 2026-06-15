import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AgentAvatar } from '@/components/ants/agent-avatar'
import { AgentStatusIndicator } from '@/components/ants/agent-status'
import { Wrench, Loader2 } from 'lucide-react'
import { useAgents, mapAgentStatus } from '@/hooks/api'
import type { AgentType } from '@/lib/api'

export function AgentsList() {
  const { data: agents, isLoading } = useAgents()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!agents || agents.length === 0) {
    return <p className="text-sm text-text-tertiary">No agents registered yet.</p>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentType }) {
  const status = mapAgentStatus(agent.status)

  return (
    <Link to="/agents/$agentId" params={{ agentId: agent.id }}>
      <Card className="group transition-colors hover:bg-surface-2">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AgentAvatar name={agent.name} tier={agent.tier} status={status} />
              <div>
                <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {agent.tier.toUpperCase()}
                </Badge>
              </div>
            </div>
            <AgentStatusIndicator status={status} label={agent.status} />
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{agent.description}</p>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>Model: {agent.model || '—'}</span>
          </div>
          {agent.tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.tools.map((tool) => (
                <Badge key={tool} variant="outline" className="text-xs">
                  <Wrench className="mr-1 h-3 w-3" />
                  {tool}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
