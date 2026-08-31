const developmentOnlyPluginPath = /(^|\/)(?:__tests__|evaluations|tests?)(?:\/|$)|\.(?:spec|test)\.[^/]+$|(^|\/)(?:validate-contract|validate-source-provenance-contract)\.mjs$/u

export const isDevelopmentOnlyPluginPath = (path) => (
  developmentOnlyPluginPath.test(path.replaceAll('\\', '/'))
)
