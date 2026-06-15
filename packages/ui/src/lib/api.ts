const API_BASE = '/v1'

// ─── Data interfaces ────────────────────────────────────────────

export interface Thread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessageSnippet?: string
  runCount: number
  activeRunId?: string
  isPinned: boolean
}

export interface Message {
  id: string
  threadId: string
  content: string
  role: 'user' | 'agent'
  agentType?: string
  agentTier?: 't1' | 't2' | 't3'
  createdAt: string
  isStreaming?: boolean
}

export interface AgentType {
  id: string
  name: string
  tier: 't1' | 't2' | 't3'
  description: string
  status: 'active' | 'paused' | 'error'
  model: string
  tools: string[]
  delegatesTo: string[]
}

export interface Run {
  id: string
  threadId: string
  agentTypeId: string
  status: 'queued' | 'running' | 'complete' | 'error' | 'cancelled'
  progress: number
  startedAt: string
  completedAt?: string
  duration: number
  inputTokens: number
  outputTokens: number
  parentRunId?: string
}

export interface RunStep {
  id: string
  runId: string
  type: 'thinking' | 'tool_use' | 'response' | 'delegate'
  agentName: string
  content: string
  createdAt: string
  duration: number
}

export interface ThreadActivity {
  threadId: string
  runs: RunTreeNode[]
  totalRuns: number
}

export interface RunTreeNode {
  run: Run
  children: RunTreeNode[]
}

export interface User {
  id: string
  email: string
  name: string
}

export interface Setting {
  id: string
  key: string
  value: Record<string, unknown>
  isGlobal: boolean
  createdAt: string
  updatedAt: string
}

export interface Tool {
  id: string
  name: string
  description: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
  createdAt: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
}

// ─── Request helper ─────────────────────────────────────────────
// All requests carry credentials: 'same-origin' so the browser
// sends the HTTP-only session cookie (ants_session) automatically.

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error ${response.status}: ${error}`)
  }

  return response.json()
}

// ─── Auth (cookie-based) ────────────────────────────────────────

export async function isAuthenticated(): Promise<boolean> {
  try {
    await request<User>('/auth/me')
    return true
  } catch {
    return false
  }
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Login failed: ${error}`)
  }
}

export async function logout(): Promise<void> {
  // Best-effort: server invalidates the session cookie.
  // Ignore network errors (e.g. offline).
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => {})
}

export async function register(
  email: string,
  name: string,
  password: string,
  inviteCode?: string,
): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password, inviteCode }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Register failed: ${error}`)
  }
  return response.json()
}

export async function verifyEmail(token: string): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/verify/${token}`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(`Verify failed: ${response.status}`)
  }
  return response.json()
}

// ─── Users ──────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User> {
  return request<User>('/auth/me')
}

export async function updateUser(data: { name?: string }): Promise<User> {
  return request<User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ─── Threads ────────────────────────────────────────────────────

export async function getThreads(): Promise<Thread[]> {
  const result = await request<{ data: Thread[]; nextCursor: string | null }>('/threads')
  return result.data
}

export async function createThread(title: string = 'New Thread'): Promise<Thread> {
  return request<Thread>('/threads', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function getThread(id: string): Promise<Thread> {
  return request<Thread>(`/threads/${id}`)
}

export async function updateThread(id: string, data: Partial<Thread>): Promise<Thread> {
  return request<Thread>(`/threads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteThread(id: string): Promise<void> {
  await request(`/threads/${id}`, { method: 'DELETE' })
}

// ─── Messages ───────────────────────────────────────────────────

// server: GET /v1/messages/:threadId
export async function getMessages(threadId: string): Promise<Message[]> {
  const result = await request<{ data: Message[]; nextCursor: string | null }>(`/messages/${threadId}`)
  return result.data
}

// server: POST /v1/messages { threadId, role, content }
export async function sendMessage(threadId: string, content: string): Promise<Message> {
  return request<Message>('/messages', {
    method: 'POST',
    body: JSON.stringify({ threadId, role: 'user', content }),
  })
}

// ─── Agents ─────────────────────────────────────────────────────

export async function getAgents(): Promise<AgentType[]> {
  return request<AgentType[]>('/agents')
}

export async function getAgent(id: string): Promise<AgentType> {
  return request<AgentType>(`/agents/${id}`)
}

export async function updateAgent(id: string, data: Partial<AgentType>): Promise<AgentType> {
  return request<AgentType>(`/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ─── Runs ───────────────────────────────────────────────────────

// server: GET /v1/runs/:id
export async function getRun(id: string): Promise<Run> {
  return request<Run>(`/runs/${id}`)
}

// server: GET /v1/runs/:id/steps
export async function getRunSteps(runId: string): Promise<RunStep[]> {
  return request<RunStep[]>(`/runs/${runId}/steps`)
}

export async function cancelRun(id: string): Promise<Run> {
  return request<Run>(`/runs/${id}/cancel`, { method: 'POST' })
}

export async function createRun(threadId: string, agentTypeId: string): Promise<Run> {
  return request<Run>('/runs', {
    method: 'POST',
    body: JSON.stringify({ threadId, agentTypeId }),
  })
}

export async function updateRunStatus(id: string, status: Run['status']): Promise<Run> {
  return request<Run>(`/runs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// ─── Thread activity ────────────────────────────────────────────

// server: GET /v1/threads/:threadId/activity
export async function getThreadActivity(threadId: string): Promise<ThreadActivity> {
  return request<ThreadActivity>(`/threads/${threadId}/activity`)
}

// ─── SSE Streaming ──────────────────────────────────────────────
// NOTE: EventSource does not support custom credentials, so we
// use fetch-based SSE instead. This ensures the session cookie
// is sent with the request via credentials: 'same-origin'.
// server: GET /v1/threads/:threadId/runs/:runId/stream

export function streamRunEvents(
  threadId: string,
  runId: string,
  onEvent: (event: Record<string, unknown>) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
): AbortController {
  const controller = new AbortController()
  let connected = true

  const connect = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/threads/${threadId}/runs/${runId}/stream`,
        {
          credentials: 'same-origin',
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (connected) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = 'message'
        let data = ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            data = line.slice(5).trim()
          } else if (line === '') {
            // Empty line = end of SSE event
            if (data) {
              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'complete') {
                  onComplete()
                  connected = false
                  reader.releaseLock()
                  return
                }
                onEvent(parsed)
              } catch {
                // Skip non-JSON data (e.g. keepalive pings)
              }
              data = ''
            }
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(err instanceof Error ? err : new Error(String(err)))
      }
    }
  }

  void connect()

  return controller
}

// ─── Settings ───────────────────────────────────────────────────

export async function getSettings(): Promise<Setting[]> {
  return request<Setting[]>('/settings')
}

export async function getSetting(key: string): Promise<Setting | null> {
  return request<Setting>(`/settings/${key}`)
}

export async function updateSetting(
  key: string,
  data: { value?: Record<string, unknown>; isGlobal?: boolean },
): Promise<Setting> {
  return request<Setting>(`/settings/${key}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSetting(key: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/settings/${key}`, { method: 'DELETE' })
}

// ─── Tools ──────────────────────────────────────────────────────

export async function getTools(): Promise<Tool[]> {
  return request<Tool[]>('/tools')
}

export async function getTool(id: string): Promise<Tool | null> {
  return request<Tool>(`/tools/${id}`)
}

export async function registerTool(
  data: { name: string; description: string; type: string; config: Record<string, unknown> },
): Promise<Tool> {
  return request<Tool>('/tools', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateTool(id: string, data: Partial<Tool>): Promise<Tool> {
  return request<Tool>(`/tools/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ─── Models ─────────────────────────────────────────────────────

export async function getModels(): Promise<ModelInfo[]> {
  return request<ModelInfo[]>('/models')
}
