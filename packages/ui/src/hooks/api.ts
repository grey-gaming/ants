import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getThreads,
  getThread,
  getMessages,
  getRun,
  getRunSteps,
  getAgents,
  getAgent,
  getCurrentUser,
  getThreadActivity,
  createThread,
  updateThread,
  deleteThread,
  sendMessage,
  cancelRun,
  updateAgent,
  updateUser,
  streamRunEvents,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  verifyEmail,
  getSettings,
  getSetting,
  updateSetting,
  deleteSetting,
  getTools,
  getTool,
  registerTool,
  updateTool,
  createRun,
  updateRunStatus,
  getModels,
  type Thread,
  type Message,
  type Run,
  type RunStep,
  type AgentType,
  type User,
  type ThreadActivity,
  type Setting,
  type Tool,
  type ModelInfo,
} from '@/lib/api'

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
  threads: ['threads'] as const,
  thread: (id: string) => ['thread', id] as const,
  messages: (threadId: string) => ['messages', threadId] as const,
  run: (runId: string) => ['run', runId] as const,
  runSteps: (runId: string) => ['runSteps', runId] as const,
  agents: ['agents'] as const,
  agent: (id: string) => ['agent', id] as const,
  user: ['user', 'me'] as const,
  activity: (threadId: string) => ['activity', threadId] as const,
  settings: ['settings'] as const,
  setting: (key: string) => ['setting', key] as const,
  tools: ['tools'] as const,
  tool: (id: string) => ['tool', id] as const,
  models: ['models'] as const,
}

// ─── Query Hooks ─────────────────────────────────────────────────────────────

export function useThreads() {
  return useQuery<Thread[], Error>({
    queryKey: queryKeys.threads,
    queryFn: getThreads,
  })
}

export function useThread(id: string) {
  return useQuery<Thread, Error>({
    queryKey: queryKeys.thread(id),
    queryFn: () => getThread(id),
  })
}

export function useMessages(threadId: string) {
  return useQuery<Message[], Error>({
    queryKey: queryKeys.messages(threadId),
    queryFn: () => getMessages(threadId),
  })
}

export function useRun(runId: string) {
  return useQuery<Run, Error>({
    queryKey: queryKeys.run(runId),
    queryFn: () => getRun(runId),
  })
}

export function useRunSteps(runId: string) {
  return useQuery<RunStep[], Error>({
    queryKey: queryKeys.runSteps(runId),
    queryFn: () => getRunSteps(runId),
  })
}

export function useAgents() {
  return useQuery<AgentType[], Error>({
    queryKey: queryKeys.agents,
    queryFn: getAgents,
  })
}

export function useAgent(id: string) {
  return useQuery<AgentType, Error>({
    queryKey: queryKeys.agent(id),
    queryFn: () => getAgent(id),
  })
}

export function useCurrentUser() {
  return useQuery<User, Error>({
    queryKey: queryKeys.user,
    queryFn: getCurrentUser,
  })
}

export function useThreadActivity(threadId: string) {
  return useQuery<ThreadActivity, Error>({
    queryKey: queryKeys.activity(threadId),
    queryFn: () => getThreadActivity(threadId),
  })
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export function useCreateThread() {
  const queryClient = useQueryClient()
  return useMutation<Thread, Error, void>({
    mutationFn: () => createThread(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.threads, (old: Thread[] | undefined) =>
        old ? [data, ...old] : [data]
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(data.id) })
    },
  })
}

export function useUpdateThread() {
  const queryClient = useQueryClient()
  return useMutation<Thread, Error, { id: string; data: Partial<Thread> }>({
    mutationFn: ({ id, data }) => updateThread(id, data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.thread(variables.id), updated)
      queryClient.setQueryData(queryKeys.threads, (old: Thread[] | undefined) =>
        old ? old.map((t) => (t.id === variables.id ? updated : t)) : undefined
      )
    },
  })
}

export function useDeleteThread() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteThread(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.thread(id) })
      queryClient.setQueryData(queryKeys.threads, (old: Thread[] | undefined) =>
        old ? old.filter((t) => t.id !== id) : undefined
      )
    },
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation<Message, Error, { threadId: string; content: string }>({
    mutationFn: ({ threadId, content }) => sendMessage(threadId, content),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.messages(variables.threadId), (old: Message[] | undefined) =>
        old ? [...old, data] : [data]
      )
    },
  })
}

export function useCancelRun() {
  const queryClient = useQueryClient()
  return useMutation<Run, Error, string>({
    mutationFn: (id) => cancelRun(id),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.run(data.id), data)
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()
  return useMutation<AgentType, Error, { id: string; data: Partial<AgentType> }>({
    mutationFn: ({ id, data }) => updateAgent(id, data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.agent(variables.id), updated)
      queryClient.setQueryData(queryKeys.agents, (old: AgentType[] | undefined) =>
        old ? old.map((a) => (a.id === variables.id ? updated : a)) : undefined
      )
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation<User, Error, { name?: string }>({
    mutationFn: (data) => updateUser(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user, data)
    },
  })
}

// ─── Specialized Hooks ───────────────────────────────────────────────────────

// ─── Utilities ──────────────────────────────────────────────────────────────

export function mapAgentStatus(
  status: 'active' | 'paused' | 'error'
): 'idle' | 'running' | 'error' {
  if (status === 'active') return 'running'
  if (status === 'paused') return 'idle'
  return 'error'
}

export function useLogin() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loginApi(email, password)
      queryClient.invalidateQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [email, password, queryClient])

  return { email, setEmail, password, setPassword, loading, error, login }
}

export function useStreamChat(threadId: string) {
  const [streaming, setStreaming] = useState(false)
  const [streamedContent, setStreamedContent] = useState('')
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  const stream = useCallback(async (contentToStream: string) => {
    setStreaming(true)
    setStreamedContent('')
    controllerRef.current = new AbortController()

    try {
      const sent = await sendMessage(threadId, contentToStream)

      // Start streaming events
      const ac = controllerRef.current
      if (!ac) return

      controllerRef.current = streamRunEvents(
        threadId,
        sent.id,
        (event) => {
          if ('content' in event && typeof event.content === 'string') {
            setStreamedContent((prev) => prev + event.content)
          }
        },
        () => {
          setStreaming(false)
          setStreamedContent('')
        },
        (err) => {
          console.error('Stream error:', err)
          setStreaming(false)
        }
      )
    } catch (err) {
      console.error('Failed to send message:', err)
      setStreaming(false)
    }
  }, [threadId])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    setStreaming(false)
    setStreamedContent('')
  }, [])

  return { streaming, streamedContent, stream, stop }
}

// ─── Auth & Registration Hooks ───────────────────────────────────────────────

export function useRegister() {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (data: { email: string; name: string; password: string; inviteCode?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const user = await registerApi(data.email, data.name, data.password, data.inviteCode)
      queryClient.invalidateQueries({ queryKey: queryKeys.user })
      return user
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [queryClient])

  return { register, loading, error, clearError: () => setError(null) }
}

export function useVerifyEmail() {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verify = useCallback(async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const user = await verifyEmail(token)
      queryClient.invalidateQueries({ queryKey: queryKeys.user })
      return user
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [queryClient])

  return { verify, loading, error, clearError: () => setError(null) }
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await logoutApi()
    queryClient.clear()
  }, [queryClient])
}

// ─── Settings Hooks ──────────────────────────────────────────────────────────

export function useSettings() {
  return useQuery<Setting[], Error>({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
  })
}

export function useSetting(key: string) {
  const { data, ...rest } = useQuery<Setting | null, Error>({
    queryKey: queryKeys.setting(key),
    queryFn: () => getSetting(key),
    retry: false,
  })
  
  return { ...rest, data: data ?? undefined as Setting | undefined }
}

export function useUpdateSetting() {
  const queryClient = useQueryClient()
  return useMutation<Setting, Error, { key: string; data: { value?: Record<string, unknown>; isGlobal?: boolean } }>({
    mutationFn: ({ key, data }) => updateSetting(key, data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.setting(variables.key), updated)
      queryClient.setQueryData(queryKeys.settings, (old: Setting[] | undefined) =>
        old ? old.map((s) => (s.key === variables.key ? updated : s)) : undefined
      )
    },
  })
}

export function useDeleteSetting() {
  const queryClient = useQueryClient()
  return useMutation<{ deleted: true }, Error, string>({
    mutationFn: (key) => deleteSetting(key),
    onSuccess: (_data, key) => {
      queryClient.removeQueries({ queryKey: queryKeys.setting(key) })
      queryClient.setQueryData(queryKeys.settings, (old: Setting[] | undefined) =>
        old ? old.filter((s) => s.key !== key) : undefined
      )
    },
  })
}

// ─── Tools Hooks ─────────────────────────────────────────────────────────────

export function useTools() {
  return useQuery<Tool[], Error>({
    queryKey: queryKeys.tools,
    queryFn: getTools,
  })
}

export function useTool(id: string) {
  const { data, ...rest } = useQuery<Tool | null, Error>({
    queryKey: queryKeys.tool(id),
    queryFn: () => getTool(id),
    retry: false,
  })
  
  return { ...rest, data: data ?? undefined as Tool | undefined }
}

export function useRegisterTool() {
  const queryClient = useQueryClient()
  return useMutation<Tool, Error, { name: string; description: string; type: string; config: Record<string, unknown> }>({
    mutationFn: ({ name, description, type, config }) => registerTool({ name, description, type, config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools })
    },
  })
}

export function useUpdateTool() {
  const queryClient = useQueryClient()
  return useMutation<Tool, Error, { id: string; data: Partial<Tool> }>({
    mutationFn: ({ id, data }) => updateTool(id, data),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.tool(variables.id), updated)
      queryClient.setQueryData(queryKeys.tools, (old: Tool[] | undefined) =>
        old ? old.map((t) => (t.id === variables.id ? updated : t)) : undefined
      )
    },
  })
}

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

// ─── Additional Run Hooks ────────────────────────────────────────────────────

export function useCreateRun() {
  const queryClient = useQueryClient()
  return useMutation<Run, Error, { threadId: string; agentTypeId: string }>({
    mutationFn: ({ threadId, agentTypeId }) => createRun(threadId, agentTypeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(data.threadId) })
    },
  })
}

export function useUpdateRunStatus() {
  const queryClient = useQueryClient()
  return useMutation<Run, Error, { id: string; status: Run['status'] }>({
    mutationFn: ({ id, status }) => updateRunStatus(id, status),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.run(data.id), data)
    },
  })
}
