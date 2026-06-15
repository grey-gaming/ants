const API_BASE = '/v1'

export interface ApiKeyAuth {
  key: string
}

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

export interface AuthResult {
  apiKey: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  expiresAt?: string
  createdAt: string
  lastUsedAt?: string
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

export async function getAuthToken(): Promise<string | null> {
  return localStorage.getItem('ants_api_key')
}

export async function setAuthToken(key: string): Promise<void> {
  localStorage.setItem('ants_api_key', key)
}

export async function clearAuthToken(): Promise<void> {
  localStorage.removeItem('ants_api_key')
}

export async function isAuthenticated(): Promise<boolean> {
  const key = await getAuthToken()
  return !!key
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error ${response.status}: ${error}`)
  }

  return response.json()
}

// Auth
export async function validateApiKey(key: string): Promise<AuthResult> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: key }),
  })
  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`)
  }
  return response.json()
}

export async function registerUser(data: { email: string; name: string; inviteCode?: string }): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Register failed: ${response.status}`)
  }
  return response.json()
}

export async function createApiKey(data: { name?: string; expiresAt?: string }): Promise<ApiKey> {
  return request<ApiKey>('/auth/keys', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getApiKeys(): Promise<ApiKey[]> {
  return request<ApiKey[]>('/auth/keys')
}

export async function revokeApiKey(id: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>('/auth/keys/' + id, { method: 'DELETE' })
}

export async function verifyEmail(token: string): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/verify/${token}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Verify failed: ${response.status}`)
  }
  return response.json()
}

export async function logout(): Promise<void> {
  await clearAuthToken()
}

// Users
export async function getCurrentUser(): Promise<User> {
  return request<User>('/users/me')
}

export async function updateUser(data: { name?: string }): Promise<User> {
  return request<User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// Threads
export async function getThreads(): Promise<Thread[]> {
  const result = await request<{ data: Thread[]; nextCursor: string | null }>('/threads')
  return result.data
}

export async function createThread(title: string = 'New Thread'): Promise<Thread> {
  return request<Thread>('/threads', { 
    method: 'POST', 
    body: JSON.stringify({ title }) 
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

// Messages — server: GET /v1/messages/:threadId
export async function getMessages(threadId: string): Promise<Message[]> {
  const result = await request<{ data: Message[]; nextCursor: string | null }>(`/messages/${threadId}`)
  return result.data
}

// Messages — server: POST /v1/messages { threadId, role, content }
export async function sendMessage(threadId: string, content: string): Promise<Message> {
  return request<Message>('/messages', {
    method: 'POST',
    body: JSON.stringify({ threadId, role: 'user', content }),
  })
}

// Agents
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

// Runs — server: GET /v1/runs/:id
export async function getRun(id: string): Promise<Run> {
  return request<Run>(`/runs/${id}`)
}

// Run steps — server: GET /v1/runs/:id/steps
export async function getRunSteps(runId: string): Promise<RunStep[]> {
  return request<RunStep[]>(`/runs/${runId}/steps`)
}

export async function cancelRun(id: string): Promise<Run> {
  return request<Run>(`/runs/${id}/cancel`, { method: 'POST' })
}

// Thread activity — server: GET /v1/threads/:threadId/activity
export async function getThreadActivity(threadId: string): Promise<ThreadActivity> {
  return request<ThreadActivity>(`/threads/${threadId}/activity`)
}

// SSE Streaming — server: GET /v1/threads/:threadId/runs/:runId/stream
export function streamRunEvents(
  threadId: string,
  runId: string,
  onEvent: (event: Record<string, unknown>) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): AbortController {
  const controller = new AbortController()

  const token = localStorage.getItem('ants_api_key')
  if (!token) {
    onError(new Error('Not authenticated'))
    return controller
  }

  const eventSource = new EventSource(`${API_BASE}/threads/${threadId}/runs/${runId}/stream`)

  eventSource.addEventListener('message', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'complete') {
        onComplete()
        eventSource.close()
      } else {
        onEvent(data)
      }
    } catch {
      // Skip non-JSON events (e.g., keepalive pings)
    }
  })

  eventSource.addEventListener('error', () => {
    onError(new Error('Stream error'))
    eventSource.close()
  })

  controller.signal.addEventListener('abort', () => {
    eventSource.close()
  })

  return controller
}

// Settings
export async function getSettings(): Promise<Setting[]> {
  return request<Setting[]>('/settings')
}

export async function getSetting(key: string): Promise<Setting | null> {
  return request<Setting>(`/settings/${key}`)
}

export async function updateSetting(key: string, data: { value?: Record<string, unknown>; isGlobal?: boolean }): Promise<Setting> {
  return request<Setting>(`/settings/${key}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSetting(key: string): Promise<{ deleted: true }> {
  return request<{ deleted: true }>(`/settings/${key}`, { method: 'DELETE' })
}

// Tools
export async function getTools(): Promise<Tool[]> {
  return request<Tool[]>('/tools')
}

export async function getTool(id: string): Promise<Tool | null> {
  return request<Tool>(`/tools/${id}`)
}

export async function registerTool(data: { name: string; description: string; type: string; config: Record<string, unknown> }): Promise<Tool> {
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

// Runs - additional endpoints
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
