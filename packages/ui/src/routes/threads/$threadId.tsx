import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ChatBubble } from '@/components/ants/chat-bubble'
import { RunTree } from '@/components/ants/run-tree'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  MoreVertical,
  Send,
  Clock,
  Zap,
  Loader2,
  Pin,
  Trash2,
} from 'lucide-react'
import { useThread, useMessages, useThreadActivity, useSendMessage, useCancelRun, useAgents, useUpdateThread, useDeleteThread } from '@/hooks/api'

type RunNode = {
  id: string
  agentName: string
  agentTier: 't1' | 't2' | 't3'
  status: 'running' | 'complete' | 'error'
  duration: number
  children: RunNode[]
}

function buildRunTree(
  nodes: Array<{ run: any; children: any[] }>,
  agents: any[] | undefined
): RunNode[] {
  return nodes.map((node) => {
    const agent = agents?.find((a) => a.id === node.run.agentTypeId)
    return {
      id: node.run.id,
      agentName: agent?.name ?? node.run.agentTypeId,
      agentTier: agent?.tier ?? 't3',
      status: node.run.status === 'running' || node.run.status === 'queued' ? 'running' : 'complete',
      duration: node.run.duration || 0,
      children: buildRunTree(node.children, agents),
    }
  })
}

export function ThreadDetailPage() {
  const { threadId } = useParams({ from: '/layout/threads/$threadId' })
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const { data: thread, isLoading: threadLoading } = useThread(threadId)
  const { data: messages, isLoading: messagesLoading } = useMessages(threadId)
  const { data: activity } = useThreadActivity(threadId)
  const { data: agents } = useAgents()
  const sendMessage = useSendMessage()
  const cancelRun = useCancelRun()
  const updateThread = useUpdateThread()
  const deleteThread = useDeleteThread()

  const loading = threadLoading || messagesLoading

  const handleSend = async () => {
    if (message.trim()) {
      await sendMessage.mutateAsync({ threadId, content: message.trim() })
      setMessage('')
    }
  }

  const runTreeData = activity ? buildRunTree(activity.runs, agents) : []

  const activeRun = activity?.runs.find((node) =>
    node.run.status === 'running' || node.run.status === 'queued'
  )?.run

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getAgentName = (agentType?: string) => {
    if (!agentType) return 'Agent'
    return agents?.find((a) => a.id === agentType)?.name ?? agentType
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface-1">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => navigate({ to: '/threads' })}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-heading-sm text-text-primary">{thread?.title ?? 'Thread'}</h1>
              <p className="text-xs text-text-tertiary">
                {activity && `Started ${activity.totalRuns} runs`}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  updateThread.mutate({
                    id: threadId,
                    data: { isPinned: !thread?.isPinned },
                  })
                }
              >
                <Pin className="h-4 w-4 mr-2" />
                {thread?.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (confirm('Delete this thread?')) {
                    deleteThread.mutate(threadId, {
                      onSuccess: () => navigate({ to: '/threads' }),
                    })
                  }
                }}
                className="text-error focus:text-error"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {!messages?.length && (
              <p className="text-center text-sm text-text-tertiary py-10">No messages yet. Start the conversation.</p>
            )}
            {messages?.map((msg) => (
              <ChatBubble
                key={msg.id}
                content={msg.content}
                role={msg.role}
                agentName={getAgentName(msg.agentType)}
                agentTier={msg.agentTier}
                isStreaming={msg.isStreaming}
                timestamp={formatTime(msg.createdAt)}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[44px] flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={sendMessage.isPending}
            />
            <Button size="icon" onClick={handleSend} className="h-[44px] w-[44px]" disabled={sendMessage.isPending || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Run detail panel */}
      <div className="hidden w-80 flex-col gap-4 lg:flex">
        {activeRun ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-heading-sm">Current Run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="animate-pulse">{activeRun.status}</Badge>
                <span className="text-xs text-text-tertiary">{activeRun.duration}s</span>
              </div>
              <Progress value={activeRun.progress ?? 0} className="h-2" />
              <div className="space-y-2 text-xs text-text-secondary">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Duration</span>
                  <span>{activeRun.duration}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Tokens</span>
                  <span>{activeRun.inputTokens} in / {activeRun.outputTokens} out</span>
                </div>
              </div>
              <Separator />
              <Button variant="outline" size="sm" className="w-full" onClick={() => cancelRun.mutate(activeRun.id)}>
                Cancel Run
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-heading-sm">Current Run</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-tertiary">No active run</p>
            </CardContent>
          </Card>
        )}

        <Card className="flex-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-heading-sm">Run Tree</CardTitle>
          </CardHeader>
          <CardContent>
            {runTreeData.length > 0 ? (
              <RunTree runs={runTreeData} />
            ) : (
              <p className="text-sm text-text-tertiary">No runs yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
