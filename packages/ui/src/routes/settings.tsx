import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useThemeStore } from '@/stores/theme'
import { Eye, EyeOff, Copy, Trash2, Plus, Shield, Loader2, Check } from 'lucide-react'
import { useCurrentUser, useModels, useDefaultModel, useSetDefaultModel } from '@/hooks/api'
import { ToolRegistry } from '@/components/settings/tool-registry'
import { AgentsList } from '@/components/settings/agents-list'

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { data: user, isLoading } = useCurrentUser()
  const [showKey, setShowKey] = useState(false)

  const apiKey = localStorage.getItem('ants_api_key') ?? ''
  const maskedKey = apiKey.length > 8 ? apiKey.slice(0, 8) + '••••' : apiKey

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-heading-lg text-text-primary">Settings</h1>
        <p className="text-body text-text-secondary mt-1">
          Manage your account, API keys, and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-md">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-body-sm font-medium text-text-secondary">
                  Display Name
                </label>
                <Input defaultValue={user?.name ?? ''} />
              </div>
              <div>
                <label className="mb-2 block text-body-sm font-medium text-text-secondary">
                  Email
                </label>
                <Input defaultValue={user?.email ?? ''} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-heading-md">API Keys</CardTitle>
                <Button size="sm" disabled>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate New Key
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-accent" />
                  <div>
                    <code className="text-sm text-text-primary">
                      {showKey ? apiKey : maskedKey}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(apiKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-error" disabled>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="model">
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-md">Model Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-body-sm font-medium text-text-secondary">
                  Endpoint URL
                </label>
                <Input defaultValue={import.meta.env.VITE_LLM_BASE_URL ?? 'http://localhost:11434'} />
              </div>
              <Separator />
              <div>
                <label className="mb-2 block text-body-sm font-medium text-text-secondary">
                  Default Model
                </label>
                <ModelSelector />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-md">Agent Registry</CardTitle>
            </CardHeader>
            <CardContent>
              <AgentsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-md">Tool Registry</CardTitle>
            </CardHeader>
            <CardContent>
              <ToolRegistry />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-heading-md">Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-3 block text-body-sm font-medium text-text-secondary">
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4 transition-colors hover:border-accent',
                        theme === t && 'border-accent bg-accent-muted'
                      )}
                    >
                      <div className={cn(
                        'flex h-12 w-full items-center justify-center rounded-md',
                        t === 'light' ? 'bg-white' : t === 'dark' ? 'bg-surface-0' : 'bg-gradient-to-r from-white to-surface-0'
                      )}>
                        <div className="h-4 w-8 rounded-sm bg-accent" />
                      </div>
                      <span className="text-xs text-text-secondary capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-primary">Reduced Motion</p>
                  <p className="text-xs text-text-tertiary">Minimize animations</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ModelSelector() {
  const { data: models, isLoading: loadingModels } = useModels()
  const { data: savedSetting } = useDefaultModel()
  const setSelected = useSetDefaultModel()

  const savedModel = typeof savedSetting === 'string' ? savedSetting : null

  if (loadingModels) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-tertiary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading models...
      </div>
    )
  }

  if (!models || models.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        No models available. Ensure Ollama or MLX is running.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {models.map((model) => {
        const isSelected = savedModel === model.id
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => setSelected.mutate({ model: model.id })}
            className={cn(
              'flex w-full items-center justify-between rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-2',
              isSelected && 'border-accent bg-accent-muted'
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-text-primary">{model.name}</span>
              <span className="text-xs text-text-tertiary capitalize">{model.provider}</span>
            </div>
            {isSelected && <Check className="h-4 w-4 text-accent" />}
          </button>
        )
      })}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
