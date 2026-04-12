import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { buildPlugins } = await import('../dist/plugin-build.js')

await buildPlugins({ repoRoot })
