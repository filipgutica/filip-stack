import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const PLUGIN_NAME = 'filip-stack'

type BuildPluginsOptions = {
  repoRoot: string
  outputRoot?: string
}

const ensureDirectory = async (path: string) => {
  await mkdir(path, { recursive: true })
}

const writeTextFile = async ({ path, content }: { path: string; content: string }) => {
  await ensureDirectory(dirname(path))
  await writeFile(path, content)
}

const loadRepoMetadata = async ({ repoRoot }: { repoRoot: string }) => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as {
    version?: unknown
    repository?: unknown
  }

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error('package.json is missing a valid version string')
  }

  return { version: packageJson.version }
}

const copyDirectory = async ({ source, destination }: { source: string; destination: string }) => {
  await cp(source, destination, {
    recursive: true,
    force: true,
  })
}

const renderTemplate = ({
  template,
  replacements,
}: {
  template: string
  replacements: Record<string, string>
}) =>
  Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`"__${key}__"`, value).replaceAll(`__${key}__`, value),
    template,
  )

const renderPluginManifest = ({
  template,
  version,
}: {
  template: string
  version: string
}) => {
  const parsed = JSON.parse(template) as Record<string, unknown>

  return `${JSON.stringify({ ...parsed, version }, null, 2)}\n`
}

const buildCodexPlugin = async ({
  repoRoot,
  outputRoot,
  version,
}: {
  repoRoot: string
  outputRoot: string
  version: string
}) => {
  const claudePluginRoot = join(repoRoot, 'plugins', PLUGIN_NAME)
  const codexRoot = join(repoRoot, 'plugin/codex')
  const notesHookScriptPath = join(outputRoot, 'scripts', 'project-notes-hook.mjs')

  await rm(outputRoot, { recursive: true, force: true })
  await copyDirectory({ source: join(claudePluginRoot, 'scripts'), destination: join(outputRoot, 'scripts') })
  await copyDirectory({ source: join(claudePluginRoot, 'skills'), destination: join(outputRoot, 'skills') })

  const [pluginTemplate, hooksTemplate] = await Promise.all([
    readFile(join(codexRoot, 'plugin.json'), 'utf8'),
    readFile(join(codexRoot, 'hooks.json'), 'utf8'),
  ])

  await writeTextFile({
    path: join(outputRoot, '.codex-plugin', 'plugin.json'),
    content: renderPluginManifest({ template: pluginTemplate, version }),
  })
  await writeTextFile({
    path: join(outputRoot, 'hooks', 'hooks.json'),
    content: `${renderTemplate({
      template: hooksTemplate.trim(),
      replacements: {
        NOTES_HOOK_COMMAND: JSON.stringify(`node ${JSON.stringify(notesHookScriptPath)} codex UserPromptSubmit`),
        NOTES_STOP_HOOK_COMMAND: JSON.stringify(`node ${JSON.stringify(notesHookScriptPath)} codex Stop`),
      },
    })}\n`,
  })
}

export const buildPlugins = async ({
  repoRoot,
  outputRoot = join(repoRoot, 'dist', 'plugins'),
}: BuildPluginsOptions) => {
  const { version } = await loadRepoMetadata({ repoRoot })
  const codexOutputRoot = join(outputRoot, 'codex', PLUGIN_NAME)

  await buildCodexPlugin({ repoRoot, outputRoot: codexOutputRoot, version })

  return {
    version,
    codexOutputRoot,
  }
}
