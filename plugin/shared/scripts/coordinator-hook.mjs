#!/usr/bin/env node

import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return chunks.join('')
}

const parsePayload = (stdin) => {
  const text = stdin.trim()
  if (text === '') return {}

  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

const extractPrompt = (payload) =>
  [
    payload.prompt,
    payload.user_prompt,
    payload.input,
    payload.text,
    payload.message,
  ].find((value) => typeof value === 'string') || ''

const isNotesCommand = (prompt) => {
  const normalized = prompt.trim().toLowerCase()
  return (
    normalized.startsWith('notes create:')
    || normalized.startsWith('notes use:')
    || normalized.startsWith('notes plan:')
    || normalized === 'notes approve'
    || normalized === 'notes complete'
  )
}

const hasExplicitCoordinatorInvocation = (prompt) => {
  const normalized = prompt.toLowerCase()
  return normalized.includes('$coordinator') || normalized.includes('$filip-stack:coordinator')
}

const findRepoRoot = async (startPath) => {
  let current = resolve(startPath)

  while (true) {
    try {
      await stat(join(current, '.git'))
      return current
    } catch {}

    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const handleUserPrompt = async ({ host, payload, stdout }) => {
  const prompt = extractPrompt(payload).trim()

  if (prompt === '' || isNotesCommand(prompt) || hasExplicitCoordinatorInvocation(prompt)) {
    return { exitCode: 0 }
  }

  stdout.push(
    'Coordinator reminder: For non-trivial engineering work, first do a bounded planning or exploration pass, delegate bounded exploration or implementation to subagents by default, use subagents for codebase exploration and adversarial review in Plan Mode, keep the main thread responsible for coordination, approval, review, and synthesis, and close completed or idle subagents before finishing.',
  )

  return { exitCode: 0 }
}

export const runHook = async ({
  host,
  event,
  payload,
  cwd,
} = {}) => {
  const stdout = []
  const stderr = []

  if (await findRepoRoot(payload?.cwd || cwd || process.cwd()) === null) return { exitCode: 0, stdout, stderr }

  if (event !== 'UserPromptSubmit') return { exitCode: 0, stdout, stderr }

  const result = await handleUserPrompt({ host, payload, stdout, stderr })
  return { ...result, stdout, stderr }
}

const main = async () => {
  const [host = 'codex', event = 'UserPromptSubmit'] = process.argv.slice(2)
  const stdin = await readStdin()
  const payload = parsePayload(stdin)
  const result = await runHook({ host, event, payload })

  if (result.stdout.length > 0) {
    process.stdout.write(`${result.stdout.join('\n')}\n`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`Coordinator hook failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
