import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
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

const copyDirectory = async ({ source, destination }: { source: string; destination: string }) => {
  await cp(source, destination, {
    recursive: true,
    force: true,
  })
}

const parseSkillDocument = (content: string) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    throw new Error('Shared skill is missing YAML frontmatter')
  }

  const frontmatter = Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.match(/^([^:]+):\s*(.*)$/))
      .filter((line): line is RegExpMatchArray => line !== null)
      .map((line) => [line[1].trim(), line[2].trim().replace(/^"|"$/g, '')]),
  )

  const description = frontmatter.description
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error('Shared skill frontmatter is missing description')
  }

  return {
    description,
    body: match[2].replace(/^\n+/, ''),
  }
}

const renderClaudeSkill = ({ content }: { content: string }) => {
  const parsed = parseSkillDocument(content)

  return ['---', `description: ${JSON.stringify(parsed.description)}`, '---', '', parsed.body.trimEnd(), ''].join('\n')
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

const buildClaudePlugin = async ({
  repoRoot,
  outputRoot,
}: {
  repoRoot: string
  outputRoot: string
}) => {
  const sharedRoot = join(repoRoot, 'plugin/shared')
  const claudeRoot = join(repoRoot, 'plugin/claude')
  const skillsSourceRoot = join(sharedRoot, 'skills')
  const scriptsSourceRoot = join(sharedRoot, 'scripts')
  const skillNames = await readdir(skillsSourceRoot)

  await rm(outputRoot, { recursive: true, force: true })
  await copyDirectory({ source: scriptsSourceRoot, destination: join(outputRoot, 'scripts') })

  for (const skillName of skillNames) {
    const sourceSkillRoot = join(skillsSourceRoot, skillName)
    const destinationSkillRoot = join(outputRoot, 'skills', skillName)
    await copyDirectory({ source: sourceSkillRoot, destination: destinationSkillRoot })

    const skillContent = await readFile(join(sourceSkillRoot, 'SKILL.md'), 'utf8')
    await writeTextFile({
      path: join(destinationSkillRoot, 'SKILL.md'),
      content: renderClaudeSkill({ content: skillContent }),
    })
  }

  const [pluginTemplate, hooksTemplate] = await Promise.all([
    readFile(join(claudeRoot, 'plugin.json'), 'utf8'),
    readFile(join(claudeRoot, 'hooks.json'), 'utf8'),
  ])

  await writeTextFile({
    path: join(outputRoot, '.claude-plugin', 'plugin.json'),
    content: `${pluginTemplate.trim()}\n`,
  })
  await writeTextFile({
    path: join(outputRoot, 'hooks', 'hooks.json'),
    content: `${hooksTemplate.trim()}\n`,
  })
}

const buildClaudeMarketplace = async ({
  outputRoot,
  pluginRoot,
}: {
  outputRoot: string
  pluginRoot: string
}) => {
  await rm(outputRoot, { recursive: true, force: true })
  await ensureDirectory(outputRoot)

  const marketplace = {
    name: 'local-plugins',
    owner: {
      name: 'Filip Gutica',
    },
    plugins: [{ name: PLUGIN_NAME, source: `./${PLUGIN_NAME}` }],
  }

  await copyDirectory({
    source: pluginRoot,
    destination: join(outputRoot, PLUGIN_NAME),
  })

  await writeTextFile({
    path: join(outputRoot, '.claude-plugin', 'marketplace.json'),
    content: `${JSON.stringify(marketplace, null, 2)}\n`,
  })
}

const buildCodexPlugin = async ({
  repoRoot,
  outputRoot,
}: {
  repoRoot: string
  outputRoot: string
}) => {
  const sharedRoot = join(repoRoot, 'plugin/shared')
  const codexRoot = join(repoRoot, 'plugin/codex')
  const hookScriptPath = join(outputRoot, 'scripts', 'project-notes-hook.mjs')

  await rm(outputRoot, { recursive: true, force: true })
  await copyDirectory({ source: join(sharedRoot, 'scripts'), destination: join(outputRoot, 'scripts') })
  await copyDirectory({ source: join(sharedRoot, 'skills'), destination: join(outputRoot, 'skills') })

  const [pluginTemplate, hooksTemplate] = await Promise.all([
    readFile(join(codexRoot, 'plugin.json'), 'utf8'),
    readFile(join(codexRoot, 'hooks.json'), 'utf8'),
  ])

  await writeTextFile({
    path: join(outputRoot, '.codex-plugin', 'plugin.json'),
    content: `${pluginTemplate.trim()}\n`,
  })
  await writeTextFile({
    path: join(outputRoot, 'hooks', 'hooks.json'),
    content: `${renderTemplate({
      template: hooksTemplate.trim(),
      replacements: {
        HOOK_COMMAND: JSON.stringify(`node ${JSON.stringify(hookScriptPath)} codex UserPromptSubmit`),
      },
    })}\n`,
  })
}

export const buildPlugins = async ({
  repoRoot,
  outputRoot = join(repoRoot, 'dist', 'plugins'),
}: BuildPluginsOptions) => {
  const claudeOutputRoot = join(outputRoot, 'claude', PLUGIN_NAME)
  const codexOutputRoot = join(outputRoot, 'codex', PLUGIN_NAME)
  const claudeMarketplaceRoot = join(dirname(outputRoot), 'marketplaces', 'claude', 'filip-stack-local')

  await buildClaudePlugin({ repoRoot, outputRoot: claudeOutputRoot })
  await buildCodexPlugin({ repoRoot, outputRoot: codexOutputRoot })
  await buildClaudeMarketplace({ outputRoot: claudeMarketplaceRoot, pluginRoot: claudeOutputRoot })

  return {
    claudeOutputRoot,
    codexOutputRoot,
    claudeMarketplaceRoot,
  }
}
