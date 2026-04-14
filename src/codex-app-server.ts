import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type {
  InitializeParams,
  PluginInstallParams,
} from './generated/codex-app-server-types.js'

export type CodexPluginInstaller = (input: {
  homeDir: string
  marketplacePath: string
  pluginName: string
  clientVersion: string
}) => Promise<void>

type PendingRequest<TResult> = {
  resolve: (value: TResult) => void
  reject: (error: Error) => void
}

type JsonRpcResponse<TResult> = {
  id?: unknown
  result?: TResult
  error?: {
    message?: unknown
  }
}

export const installCodexPluginViaAppServer: CodexPluginInstaller = async ({
  homeDir,
  marketplacePath,
  pluginName,
  clientVersion,
}) => {
  const child = spawn('codex', ['app-server'], {
    env: { ...process.env, HOME: homeDir },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const stderr: string[] = []
  const pending = new Map<number, PendingRequest<unknown>>()
  let nextRequestId = 1
  let exited = false

  child.stderr.on('data', (chunk) => {
    stderr.push(chunk.toString())
  })

  child.on('error', (error) => {
    for (const { reject } of pending.values()) {
      reject(error)
    }
    pending.clear()
  })

  child.on('exit', (code, signal) => {
    exited = true
    const details = stderr.join('').trim()
    const suffix = details.length > 0 ? `\n${details}` : ''
    const message = `codex app-server exited before the plugin install completed (code=${code ?? 'null'}, signal=${signal ?? 'null'})${suffix}`
    for (const { reject } of pending.values()) {
      reject(new Error(message))
    }
    pending.clear()
  })

  const stdout = createInterface({ input: child.stdout })
  stdout.on('line', (line) => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return

    let message: JsonRpcResponse<unknown>
    try {
      message = JSON.parse(trimmed)
    } catch {
      return
    }

    if (typeof message !== 'object' || message === null || !('id' in message)) return
    const id = message.id
    if (typeof id !== 'number') return
    const pendingRequest = pending.get(id)
    if (!pendingRequest) return

    pending.delete(id)

    if (message.error !== undefined) {
      const error = message.error
      const details = stderr.join('').trim()
      const errorMessage = typeof error?.message === 'string'
        ? error.message
        : 'codex app-server returned an unknown error'
      const suffix = details.length > 0 ? `\n${details}` : ''
      pendingRequest.reject(new Error(`${errorMessage}${suffix}`))
      return
    }

    pendingRequest.resolve(message.result)
  })

  const request = async <TParams, TResult>({
    method,
    params,
  }: {
    method: string
    params: TParams
  }) => {
    if (exited || child.stdin.destroyed) {
      throw new Error('codex app-server is not available')
    }

    const id = nextRequestId++
    const response = new Promise<TResult>((resolve, reject) => {
      pending.set(id, { resolve, reject } as PendingRequest<unknown>)
    })

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    return response
  }

  try {
    const initializeParams: InitializeParams = {
      clientInfo: {
        name: 'filip-stack-installer',
        version: clientVersion,
      },
      capabilities: {
        experimentalApi: true,
      },
    }
    await request<InitializeParams, unknown>({
      method: 'initialize',
      params: initializeParams,
    })

    const installParams: PluginInstallParams = {
      marketplacePath,
      pluginName,
      forceRemoteSync: false,
    }
    await request<PluginInstallParams, unknown>({
      method: 'plugin/install',
      params: installParams,
    })
  } finally {
    stdout.close()
    child.kill()
  }
}
