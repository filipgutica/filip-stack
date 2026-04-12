import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFile = promisify(execFileCallback)

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(repoRoot, 'src', 'generated', 'codex-app-server-types.ts')

const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const main = async () => {
  const schemaRoot = await mkdtemp(join(tmpdir(), 'filip-stack-codex-schema-'))

  try {
    await execFile('codex', ['app-server', 'generate-json-schema', '--out', schemaRoot], {
      env: process.env,
    })

    const clientRequest = await loadJson(join(schemaRoot, 'ClientRequest.json'))
    const requestId = await loadJson(join(schemaRoot, 'RequestId.json'))
    const initializeParams = await loadJson(join(schemaRoot, 'v1', 'InitializeParams.json'))
    const pluginInstallParams = await loadJson(join(schemaRoot, 'v2', 'PluginInstallParams.json'))

    assert(clientRequest.title === 'ClientRequest', 'Unexpected ClientRequest schema title')
    assert(requestId.title === 'RequestId', 'Unexpected RequestId schema title')
    assert(initializeParams.title === 'InitializeParams', 'Unexpected InitializeParams schema title')
    assert(pluginInstallParams.title === 'PluginInstallParams', 'Unexpected PluginInstallParams schema title')

    const clientRequestMethods = new Set(
      Array.isArray(clientRequest.oneOf)
        ? clientRequest.oneOf
            .map((entry) => entry?.properties?.method?.enum?.[0])
            .filter((method) => typeof method === 'string')
        : [],
    )

    assert(clientRequestMethods.has('initialize'), 'ClientRequest is missing initialize')
    assert(clientRequestMethods.has('plugin/install'), 'ClientRequest is missing plugin/install')

    assert(
      Array.isArray(requestId.anyOf) &&
        requestId.anyOf.some((entry) => entry?.type === 'string') &&
        requestId.anyOf.some((entry) => entry?.type === 'integer'),
      'RequestId no longer matches the expected schema shape',
    )

    assert(
      initializeParams.properties?.clientInfo?.$ref === '#/definitions/ClientInfo',
      'InitializeParams.clientInfo no longer matches the expected schema shape',
    )
    assert(
      initializeParams.definitions?.ClientInfo?.properties?.name?.type === 'string' &&
        initializeParams.definitions?.ClientInfo?.properties?.version?.type === 'string',
      'ClientInfo no longer matches the expected schema shape',
    )
    assert(
      initializeParams.definitions?.ClientInfo?.properties?.title?.type?.includes?.('null') === true,
      'ClientInfo.title no longer matches the expected schema shape',
    )
    assert(
      initializeParams.definitions?.InitializeCapabilities?.properties?.experimentalApi?.type === 'boolean',
      'InitializeCapabilities.experimentalApi no longer matches the expected schema shape',
    )
    assert(
      initializeParams.definitions?.InitializeCapabilities?.properties?.optOutNotificationMethods?.type?.includes?.('null') === true,
      'InitializeCapabilities.optOutNotificationMethods no longer matches the expected schema shape',
    )
    assert(
      pluginInstallParams.properties?.marketplacePath?.$ref === '#/definitions/AbsolutePathBuf',
      'PluginInstallParams.marketplacePath no longer matches the expected schema shape',
    )
    assert(
      pluginInstallParams.definitions?.AbsolutePathBuf?.type === 'string',
      'AbsolutePathBuf no longer matches the expected schema shape',
    )
    assert(
      pluginInstallParams.properties?.pluginName?.type === 'string',
      'PluginInstallParams.pluginName no longer matches the expected schema shape',
    )
    assert(
      pluginInstallParams.properties?.forceRemoteSync?.type === 'boolean',
      'PluginInstallParams.forceRemoteSync no longer matches the expected schema shape',
    )

    const contents = `// GENERATED CODE! DO NOT MODIFY BY HAND!

// This file is generated from \`codex app-server generate-json-schema\`.
// It intentionally only covers the request shapes Filip Stack currently needs.

export type RequestId = string | number

export type ClientInfo = {
  name: string
  version: string
  title?: string | null
}

export type InitializeCapabilities = {
  experimentalApi?: boolean
  optOutNotificationMethods?: Array<string> | null
}

export type InitializeParams = {
  clientInfo: ClientInfo
  capabilities?: InitializeCapabilities | null
}

export type AbsolutePathBuf = string

export type PluginInstallParams = {
  marketplacePath: AbsolutePathBuf
  pluginName: string
  forceRemoteSync?: boolean
}

export type JsonRpcRequest<Method extends string, Params> = {
  jsonrpc: '2.0'
  id: RequestId
  method: Method
  params: Params
}

export type InitializeRequest = JsonRpcRequest<'initialize', InitializeParams>

export type PluginInstallRequest = JsonRpcRequest<'plugin/install', PluginInstallParams>

export type CodexAppServerRequest = InitializeRequest | PluginInstallRequest
`

    await writeFile(outputPath, contents)
  } finally {
    await rm(schemaRoot, { recursive: true, force: true })
  }
}

await main()
