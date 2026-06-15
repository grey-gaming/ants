import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Wrench, Loader2, Code, ChevronRight } from 'lucide-react'
import { useTools } from '@/hooks/api'
import type { Tool } from '@/lib/api'

export function ToolRegistry() {
  const { data: tools, isLoading } = useTools()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!tools || tools.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">No tools registered yet.</p>
    )
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  )
}

function ToolCard({ tool }: { tool: Tool }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-md border border-border px-4 py-3 text-left transition-colors hover:bg-surface-2">
          <div className="flex items-center gap-3">
            <Wrench className="h-4 w-4 text-text-tertiary shrink-0" />
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-medium text-text-primary">{tool.name}</span>
              <span className="text-xs text-text-tertiary line-clamp-1 max-w-[280px]">{tool.description}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={tool.enabled ? 'default' : 'secondary'} className="text-xs">
              {tool.enabled ? 'Active' : 'Disabled'}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{tool.type}</Badge>
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-accent" />
            {tool.name}
          </DialogTitle>
        </DialogHeader>
        <ToolDetails tool={tool} />
      </DialogContent>
    </Dialog>
  )
}

function ToolDetails({ tool }: { tool: Tool }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-text-secondary mb-1">Description</p>
        <p className="text-sm text-text-primary">{tool.description || 'No description provided.'}</p>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">Type</p>
          <Badge variant="outline" className="text-xs capitalize">{tool.type}</Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">Status</p>
          <Badge variant={tool.enabled ? 'default' : 'secondary'}>{tool.enabled ? 'Active' : 'Disabled'}</Badge>
        </div>
      </div>

      {tool.config && Object.keys(tool.config).length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5" />
              Configuration
            </p>
            <pre className="rounded-md bg-surface-0 border border-border p-3 overflow-auto max-h-48">
              <code className="text-xs text-text-primary">
                {JSON.stringify(tool.config, null, 2)}
              </code>
            </pre>
          </div>
        </>
      )}

      <Separator />
      <div className="text-xs text-text-tertiary">
        Created: {new Date(tool.createdAt).toLocaleString()}
      </div>
    </div>
  )
}
