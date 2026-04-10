import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { readOptionalFile } from './fs.js'

export type SetupShellAliasOptions = {
  rcFile: string
  aliasName: string
  commandPath: string
  dryRun: boolean
  log?: (message: string) => void
}

const marker = (aliasName: string) => `# filip-stack: ${aliasName}`

const aliasLine = ({ aliasName, commandPath }: Pick<SetupShellAliasOptions, 'aliasName' | 'commandPath'>) =>
  `alias ${aliasName}=${JSON.stringify(commandPath)}`

export const setupShellAlias = async ({
  rcFile,
  aliasName,
  commandPath,
  dryRun,
  log = console.log,
}: SetupShellAliasOptions): Promise<void> => {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(aliasName)) {
    throw new Error(`Invalid alias name: ${aliasName}`)
  }

  const markerLine = marker(aliasName)
  const entry = `${markerLine}\n${aliasLine({ aliasName, commandPath })}\n`
  const existingContent = await readOptionalFile(rcFile) ?? ''

  if (existingContent.includes(markerLine)) {
    log(`alias already configured in ${rcFile}`)
    return
  }

  if (dryRun) {
    log(`would append alias to ${rcFile}: ${aliasName} -> ${commandPath}`)
    return
  }

  await mkdir(dirname(rcFile), { recursive: true })

  const prefix = existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n' : ''
  await writeFile(rcFile, `${existingContent}${prefix}\n${entry}`)
  log(`added alias to ${rcFile}: ${aliasName} -> ${commandPath}`)
}
