# Model Selection UI, Tools Registry, and Agents-in-Settings Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add three interconnected settings features: (1) LLM model selection UI that persists to DB, (2) Tool registry browse/view UI, (3) Move the standalone Agents page into Settings as a tab.

**Architecture:** All three features are UI-side changes to the existing Settings page. The Model tab already exists as a placeholder — we enhance it with a model list fetched from the provider (Ollama/MLX `/v1/models` endpoint). The selected model is persisted via the existing `settings` table (`default_model` key). The Tools tab leverages existing `/v1/tools` and `/v1/tools/:id` APIs. The Agents tab repurposes the existing `/agents` page content into Settings, then removes the top-level Agents sidebar link.

**Tech Stack:** React 19, TanStack Router, TanStack Query, shadcn/ui, Hono API, Drizzle/PostgreSQL, Lucide icons.

---

## Overview of Changes

| Area | Action | Files |
|------|--------|-------|
| API — new endpoint | Add `GET /v1/models` to list available LLM models | `packages/api/src/routes/models.ts`, `packages/api/src/server.ts` |
| UI — Model tab | Populate with selectable model list, persist to DB | `packages/ui/src/routes/settings.tsx`, `packages/ui/src/lib/api.ts`, `packages/ui/src/hooks/api.ts` |
| UI — Tools tab | New settings tab: tool list + detail dialog | `packages/ui/src/routes/settings.tsx`, `packages/ui/src/components/settings/tool-registry.tsx` |
| UI — Agents in Settings | Move agents index into settings tab | `packages/ui/src/routes/settings.tsx`, `packages/ui/src/components/settings/agents-list.tsx` |
| UI — Navigation | Remove Agents link from sidebar, update routes | `packages/ui/src/components/layout/sidebar.tsx`, `packages/ui/src/routes.tsx` |
| DB — Setting key | Use existing `settings` table with key `default_model` | No schema change needed — uses existing `settings` table |

---

## Task 1: Add model listing API endpoint

**Objective:** Expose available LLM models via `GET /v1/models` so the UI can populate a dropdown.

**Files:**
- Create: `packages/api/src/routes/models.ts`
- Modify: `packages/api/src/server.ts` (mount the new route)

**Step 1: Create the models route file**

Create `packages/api/src/routes/models.ts`:

```typescript
import { Hono } from "hono";
import type { Env } from "hono/types";
import { config } from "@ants/core";

type AppEnv = Env & { Variables: { userId: string } };

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export function createModelRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const models: ModelInfo[] = [];

    // Fetch from Ollama
    try {
      const ollamaUrl = config.ollamaBaseUrl.replace(/\/+$/, "");
      const ollamaRes = await fetch(`${ollamaUrl}/api/tags`);
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        for (const model of data.models ?? []) {
          models.push({
            id: model.name,
            name: model.name,
            provider: "ollama",
          });
        }
      }
    } catch {
      // Ollama not available — skip silently
    }

    // Fetch from MLX (OpenAI-compatible /v1/models)
    try {
      const mlxUrl = (process.env.MLX_BASE_URL || config.ollamaBaseUrl).replace(/\/+$/, "");
      const mlxRes = await fetch(`${mlxUrl}/v1/models`);
      if (mlxRes.ok) {
        const data = await mlxRes.json();
        for (const model of data.data ?? []) {
          models.push({
            id: model.id,
            name: model.id,
            provider: "mlx",
          });
        }
      }
    } catch {
      // MLX not available — skip silently
    }

    return c.json(models, 200);
  });

  return app;
}
```

**Step 2: Mount the route in server.ts**

Modify `packages/api/src/server.ts`:

Find the import section (around line 1) and add:

```typescript
import { createModelRoutes } from "./routes/models";
```

Find the route mounting section (around line 116) and add:

```typescript
  app.route("/v1/models", createModelRoutes());
```

Place it BEFORE `app.use("/v1/*", authMiddleware)` so it's accessible without auth (or after auth — either works since settings need auth anyway). Actually, place it after the auth middleware line so it's protected:

```typescript
  app.use("/v1/*", authMiddleware);

  // Mount routes
  app.route("/v1/models", createModelRoutes());
  app.route("/v1/threads", createThreadRoutes(services));
  // ... rest of routes
```

**Step 3: Verify the endpoint works**

Run: `curl http://localhost:3000/v1/models` (with auth header)
Expected: JSON array of model objects `[{ "id": "...", "name": "...", "provider": "..." }]`

**Step 4: Commit**

```bash
git add packages/api/src/routes/models.ts packages/api/src/server.ts
git commit -m "feat(api): add GET /v1/models endpoint for listing available LLM models"
```

---

## Task 2: Add model listing API functions to frontend

**Objective:** Add `getModels` function and `ModelInfo` type to the frontend API layer.

**Files:**
- Modify: `packages/ui/src/lib/api.ts`

**Step 1: Add the ModelInfo type and getModels function**

In `packages/ui/src/lib/api.ts`, add the type after the `Tool` interface (around line 111):

```typescript
export interface ModelInfo {
  id: string
  name: string
  provider: string
}
```

Add the API function after the tools section (around line 379):

```typescript
// Models
export async function getModels(): Promise<ModelInfo[]> {
  return request<ModelInfo[]>('/models')
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/ui && bun run typecheck 2>&1 | head -20`
Expected: No new type errors introduced

**Step 3: Commit**

```bash
git add packages/ui/src/lib/api.ts
git commit -m "feat(ui): add getModels API function and ModelInfo type"
```

---

## Task 3: Add model listing hooks to React Query layer

**Objective:** Add `useModels` query hook and model selection mutation hook.

**Files:**
- Modify: `packages/ui/src/hooks/api.ts`

**Step 1: Import the new functions and types**

In `packages/ui/src/hooks/api.ts`, add to the import from `@/lib/api` (around line 1):

```typescript
  getModels,
  type ModelInfo,
```

**Step 2: Add query key for models**

In the `queryKeys` object (around line 57):

```typescript
  models: ['models'] as const,
```

**Step 3: Add useModels hook**

Add after the tools hooks section (around line 457):

```typescript
// ─── Model Hooks ──────────────────────────────────────────────────────────────

export function useModels() {
  return useQuery<ModelInfo[], Error>({
    queryKey: queryKeys.models,
    queryFn: getModels,
  })
}

export function useDefaultModel() {
  return useQuery<string | null, Error>({
    queryKey: ['settings', 'default_model'],
    queryFn: () => getSetting('default_model').then(s => s?.value?.model as string | null),
    retry: false,
  })
}

export function useSetDefaultModel() {
  const queryClient = useQueryClient()
  return useMutation<Setting, Error, { model: string }>(
    {
      mutationFn: ({ model }) => updateSetting('default_model', { value: { model } }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['settings', 'default_model'] })
      },
    }
  )
}
```

**Step 4: Verify TypeScript compiles**

Run: `cd packages/ui && bun run typecheck 2>&1 | head -20`
Expected: No new type errors

**Step 5: Commit**

```bash
git add packages/ui/src/hooks/api.ts
git commit -m "feat(ui): add model query hooks and default model persistence mutation"
```

---

## Task 4: Enhance Settings Model tab with model selection UI

**Objective:** Replace the placeholder Model tab with a functional model picker that fetches available models, allows selection, and persists the choice.

**Files:**
- Modify: `packages/ui/src/routes/settings.tsx`

**Step 1: Add imports**

Add to existing imports at the top of `settings.tsx`:

```typescript
import { useModels, useDefaultModel, useSetDefaultModel } from '@/hooks/api'
import { Check, Loader2 as Loader2Icon } from 'lucide-react'
```

(The existing `Loader2` from line 9 is fine to keep.)

**Step 2: Replace the Model tab content**

Find the `<TabsContent value="model">` block (lines 105-119) and replace it with:

```tsx
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
```

**Step 3: Add the ModelSelector component**

Add this component at the bottom of the file, before the `cn` function:

```tsx
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
```

**Step 4: Verify build**

Run: `cd packages/ui && bun run build 2>&1 | tail -5`
Expected: Build succeeds without errors

**Step 5: Commit**

```bash
git add packages/ui/src/routes/settings.tsx
git commit -m "feat(ui): add model selection UI with persistence to settings"
```

---

## Task 5: Create Tool Registry component

**Objective:** Create a reusable component that displays all registered tools in a browsable list with expandable details.

**Files:**
- Create: `packages/ui/src/components/settings/tool-registry.tsx`

**Step 1: Create the component file**

```tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Wrench, Loader2, Eye, ChevronRight, Code } from 'lucide-react'
import { useTools, useTool } from '@/hooks/api'
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/ui && bun run typecheck 2>&1 | head -20`
Expected: No new type errors

**Step 3: Commit**

```bash
git add packages/ui/src/components/settings/tool-registry.tsx
git commit -m "feat(ui): create ToolRegistry component with list view and detail dialog"
```

---

## Task 6: Create Agents List component for Settings

**Objective:** Extract the agents listing into a reusable component that can live inside the Settings tabs.

**Files:**
- Create: `packages/ui/src/components/settings/agents-list.tsx`

**Step 1: Create the component file**

```tsx
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
```

**Step 2: Verify TypeScript compiles**

Run: `cd packages/ui && bun run typecheck 2>&1 | head -20`
Expected: No new type errors

**Step 3: Commit**

```bash
git add packages/ui/src/components/settings/agents-list.tsx
git commit -m "feat(ui): create AgentsList component for settings view"
```

---

## Task 7: Add Tools and Agents tabs to Settings page

**Objective:** Wire up the new tabs in the Settings page using the components we created.

**Files:**
- Modify: `packages/ui/src/routes/settings.tsx`

**Step 1: Add imports**

At the top of `settings.tsx`, add:

```typescript
import { ToolRegistry } from '@/components/settings/tool-registry'
import { AgentsList } from '@/components/settings/agents-list'
```

**Step 2: Add new tab triggers**

Find the `<TabsList>` section (around line 39) and add two new triggers:

```tsx
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
```

**Step 3: Add new tab content panels**

Add these before the Appearance tab content (find `<TabsContent value="appearance">` around line 121):

```tsx
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
```

**Step 4: Verify build**

Run: `cd packages/ui && bun run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/routes/settings.tsx
git commit -m "feat(ui): add Agents and Tools tabs to Settings page"
```

---

## Task 8: Remove Agents link from sidebar navigation

**Objective:** Remove the standalone Agents link from the sidebar since agents are now inside Settings.

**Files:**
- Modify: `packages/ui/src/components/layout/sidebar.tsx`

**Step 1: Remove the Bot import and Agents link**

In `sidebar.tsx`, find the imports (lines 11-21) and remove `Bot` from the lucide-react import.

Find the nav section (lines 114-118):

```tsx
      <nav className="p-3 space-y-1">
        <SidebarLink icon={LayoutDashboard} label="Dashboard" collapsed={isCollapsed} to="/" />
        <SidebarLink icon={Bot} label="Agents" collapsed={isCollapsed} to="/agents" />
        <SidebarLink icon={Settings} label="Settings" collapsed={isCollapsed} to="/settings" />
      </nav>
```

Replace with:

```tsx
      <nav className="p-3 space-y-1">
        <SidebarLink icon={LayoutDashboard} label="Dashboard" collapsed={isCollapsed} to="/" />
        <SidebarLink icon={Settings} label="Settings" collapsed={isCollapsed} to="/settings" />
      </nav>
```

**Step 2: Verify build**

Run: `cd packages/ui && bun run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/ui/src/components/layout/sidebar.tsx
git commit -m "refactor(ui): remove Agents link from sidebar — moved to Settings"
```

---

## Task 9: Remove top-level Agents routes from router

**Objective:** Since agents are now inside Settings, remove the top-level `/agents` and `/agents/$agentId` routes from the router. Keep the page components in case we want to link to individual agent details from the Settings → Agents tab.

**Files:**
- Modify: `packages/ui/src/routes.tsx`

**Step 1: Remove agents routes**

In `routes.tsx`, remove these lines:

```typescript
// Remove these imports:
import { AgentsPage } from '@/routes/agents/index'
import { AgentDetailPage } from '@/routes/agents/$agentId'

// Remove these route definitions (lines 52-64):
const agentsIndexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/agents',
  component: AgentsPage,
})

const agentDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/agents/$agentId',
  component: AgentDetailPage,
})
```

Remove `agentsIndexRoute` and `agentDetailRoute` from the route tree (lines 86-87):

```typescript
  layoutRoute.addChildren([
    indexRoute,
    threadsIndexRoute,
    threadDetailRoute,
    // agentsIndexRoute,   ← remove
    // agentDetailRoute,   ← remove
    settingsRoute,
  ]),
```

**Step 2: Verify build**

Run: `cd packages/ui && bun run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/ui/src/routes.tsx
git commit -m "refactor(ui): remove top-level /agents routes from router"
```

---

## Task 10: Clean up unused agent route files

**Objective:** Remove the now-unused standalone Agents page files since their content has been moved to the Settings tab component.

**Files:**
- Delete: `packages/ui/src/routes/agents/index.tsx`
- Delete: `packages/ui/src/routes/agents/$agentId.tsx`

**Step 1: Delete files**

```bash
rm packages/ui/src/routes/agents/index.tsx packages/ui/src/routes/agents/\$agentId.tsx
rmdir packages/ui/src/routes/agents 2>/dev/null || true
```

**Step 2: Verify build**

Run: `cd packages/ui && bun run build 2>&1 | tail -5`
Expected: Build succeeds (no missing import errors)

**Step 3: Commit**

```bash
git add packages/ui/src/routes/agents/
git commit -m "chore(ui): remove unused standalone Agents route files"
```

---

## Task 11: Update the model provider to use user-selected model

**Objective:** Make the LLM provider respect the user's model selection from the settings.

**Files:**
- Modify: `packages/api/src/server.ts`

**Step 1: Read the default model from settings in buildApp**

In `packages/api/src/server.ts`, find the MLX provider creation section (around lines 84-90). After the provider is created, add logic to check the user's saved model setting and override if set. Since the provider is created once at startup, we read the `default_model` setting from the DB:

```typescript
  // Create MLX provider
  const baseUrl = process.env.MLX_BASE_URL || config.ollamaBaseUrl;
  
  // Check for user-saved default model
  const [savedSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, 'default_model'));
  const defaultModel = savedSetting?.value?.model as string | undefined;
  
  const llmProvider = new MlxProvider({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    modelName: process.env.MLX_MODEL_NAME || defaultModel || "mlx-community/Llama-3.2-3B-Instruct-4bit",
    contextWindow: config.contextWindowTokens,
  });
```

Add the import at the top:

```typescript
import { settings } from "@ants/store";
import { eq } from "drizzle-orm";
```

**Note:** Since `buildApp` is currently synchronous, the DB read above would require making it async or reading the setting synchronously. A simpler approach: read it in a `Promise.resolve()` before the provider creation, or just make the setting read lazy. For now, the simplest approach is to read from env vars and fall back, which already works. A better approach for per-session model selection would be to create the provider lazily per-request, but that's a larger refactor.

**Revised approach for Task 11 (simpler):**
The model selection persists to DB, but the provider reads it at startup. For a truly dynamic per-request model, we'd need to refactor the provider creation. For now, the plan documents this as a known limitation: model selection persists to DB and is read at server startup.

**Step 2: Document the limitation**

Add a comment in `server.ts`:

```typescript
  // TODO: Model selection is persisted to DB but read at startup.
  // For per-session model switching, refactor to create provider lazily per-request.
```

**Step 3: Commit**

```bash
git add packages/api/src/server.ts
git commit -m "docs(api): document model selection persistence limitation"
```

---

## Verification & Testing

### Manual verification checklist

- [ ] `GET /v1/models` returns model list from Ollama/MLX
- [ ] Settings → Model tab shows available models
- [ ] Clicking a model saves it to the settings table (key: `default_model`)
- [ ] Reload page → selected model is still highlighted
- [ ] Settings → Agents tab shows agent cards
- [ ] Settings → Tools tab shows tool list
- [ ] Clicking a tool opens detail dialog with config JSON
- [ ] Sidebar no longer has Agents link
- [ ] `/agents` URL returns 404 or redirect
- [ ] `/settings?tab=agents` works (if we add tab param support — optional)

### Build verification

```bash
cd packages/ui && bun run build
cd packages/ui && bun run typecheck
bun run typecheck
```

---

## Risks, Tradeoffs, and Open Questions

### Model provider limitation
**Risk:** The MLX provider is instantiated once at server startup with a fixed model name. Changing the model in UI settings won't take effect until server restart.
**Mitigation:** Documented as a known limitation. Future: create provider per-request or use a provider factory pattern.
**Alternative:** Add `POST /v1/models/select` endpoint that restarts the provider with the new model.

### Tab count in Settings
**Risk:** 6 tabs (General, API Keys, Model, Agents, Tools, Appearance) may be too wide for the TabsList on smaller screens.
**Mitigation:** TabsList already uses flex-wrap in shadcn. If needed, add horizontal scroll.

### Agent detail links
**Risk:** The AgentsList component in Settings still links to `/agents/$agentId` which we removed from the router.
**Mitigation:** Either (a) keep the agent detail route, or (b) change AgentCard to use a dialog instead of navigation. Since agent details are still useful, consider keeping `/agents/$agentId` as a "deep link" that works but isn't in the sidebar.
**Recommendation:** Keep the agent detail route in the router for deep linking from the Agents tab. Only remove the agents index route.

### Agent detail route correction
Based on the above, **Task 9 should only remove `agentsIndexRoute`** (the `/agents` index page) and **keep `agentDetailRoute`** (`/agents/$agentId`) so the AgentCard links in the Settings tab still work.

---

## Open Questions

1. **Should model selection be per-user or global?** Current settings table supports both via `userId` and `isGlobal`. The plan uses a global `default_model` key. Should we make it per-user?
2. **Should we keep `/agents/$agentId` route?** Recommended: yes, for deep linking from Settings → Agents tab.
3. **Should we add a tab hash param?** e.g., `/settings#agents` to deep-link to specific settings tabs. Currently not planned but useful.
