import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AgentAvatar } from '@/components/ants/agent-avatar'
import { AgentStatusIndicator } from '@/components/ants/agent-status'
import { Plus, Wrench, ArrowRight, Loader2 } from 'lucide-react'
import { useAgents } from '@/hooks/api'

function mapAgentStatus(status: 'active' | 'paused' | 'error'): 'idle' | 'running' | 'error' {
  if (status === 'active') return 'running'
  if (status === 'paused') return 'idle'
  return 'error'
}

export function AgentsPage() {
  const { data: agents, isLoading } = useAgents()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-heading-lg text-text-primary">Agents</h1>
        <Button size="sm" disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {agents?.length === 0 && (
            <p className="text-sm text-text-tertiary">No agents registered yet.</p>
          )}
          {/* Agent list */}
          <div className="grid gap-4 md:grid-cols-2">
            {agents?.map((agent) => (
              <Link key={agent.id} to="/agents/$agentId" params={{ agentId: agent.id }}>
                <Card className="group transition-colors hover:bg-surface-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <AgentAvatar name={agent.name} tier={agent.tier} status={mapAgentStatus(agent.status)} />
                        <div>
                          <CardTitle className="text-heading-md">{agent.name}</CardTitle>
                          <div className="mt-1">
                            <Badge variant="secondary">
                              {agent.tier.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <AgentStatusIndicator status={mapAgentStatus(agent.status)} label={agent.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-text-secondary">{agent.description}</p>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <span>Model: {agent.model}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.map((tool) => (
                        <Badge key={tool} variant="outline" className="text-xs">
                          <Wrench className="mr-1 h-3 w-3" />
                          {tool}
                        </Badge>
                      ))}
                    </div>
                    {agent.delegatesTo.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-text-tertiary mb-1">Delegates to:</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.delegatesTo.map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <Button variant="ghost" size="sm" className="text-xs">
                        View Details <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
