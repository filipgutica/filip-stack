// GENERATED CODE! DO NOT MODIFY BY HAND!

// This file is generated from `codex app-server generate-json-schema`.
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
