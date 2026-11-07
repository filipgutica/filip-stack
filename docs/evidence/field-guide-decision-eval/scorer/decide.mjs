#!/usr/bin/env node
// Field Guide capture-decision eval. Usage, from the repository root:
//   node docs/evidence/field-guide-decision-eval/scorer/decide.mjs <cases.json> --model <id> [--model <id>]
//     [--arm vanilla|hook|full ...] [--attempts <n>] [--plugin-root <dir>] [--out <dir>] [--api-key-file <path>] [--dry-run]
// Sends each finished-task case to models through a local CLIProxyAPI endpoint, once per arm and attempt:
//   vanilla  a minimal capture/ask/skip instruction and no Field Guide text
//   hook     the UserPromptSubmit hook text and the skill's description, which is all an agent sees
//            before it chooses to load the skill
//   full     the hook text plus SKILL.md and capture-policy.md
// Every arm gets the same reply format and case text. Raw replies go to --out (default: a new folder
// under the temporary directory), never into the repository. The last line is the score over all attempts.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const usage = 'Usage: decide.mjs <cases.json> --model <id> [--model <id>] [--arm vanilla|hook|full ...] [--attempts <n>] [--plugin-root <dir>] [--out <dir>] [--api-key-file <path>] [--dry-run]'
const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', multiple: true, default: [] },
    arm: { type: 'string', multiple: true, default: [] },
    attempts: { type: 'string', default: '3' },
    'plugin-root': { type: 'string', default: 'plugins/field-guide' },
    out: { type: 'string' },
    'api-key-file': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})
if (positionals.length !== 1) throw new Error(usage)
const attempts = Number(options.attempts)
if (!Number.isInteger(attempts) || attempts < 1) throw new Error(`--attempts must be a positive integer\n${usage}`)
const arms = options.arm.length > 0 ? options.arm : ['vanilla', 'hook', 'full']
for (const arm of arms) if (!['vanilla', 'hook', 'full'].includes(arm)) throw new Error(`Unknown arm ${arm}\n${usage}`)
const concurrency = 4

// Arm text comes from the plugin files, so a climb can point --plugin-root at a candidate copy.
const pluginRoot = resolve(options['plugin-root'])
const read = (path) => readFileSync(join(pluginRoot, path), 'utf8')
const hookText = read('hooks/field-guide-lifecycle.mjs').match(/const promptContext = '([^']+)'/u)?.[1]
const skillText = read('skills/field-guide/SKILL.md')
const skillDescription = skillText.match(/^description:\s*"?(.+?)"?$/mu)?.[1]
const skillBody = skillText.replace(/^---\n[\s\S]*?\n---\n?/u, '')
const policy = read('skills/field-guide/references/capture-policy.md')
if (!hookText || !skillDescription) throw new Error(`Could not read the hook text or skill description under ${pluginRoot}`)

const replyFormat = `The conversation has ended and you are about to give your final response. Do not redo the task. Reply with only this JSON:
{"decision": "capture|ask|skip", "scope": "shared|project|null", "origin": "explicit|inferred|null", "relationship": "new|reinforces|refines|contradicts|null", "relatedId": "<stored record id>|null", "subjectKey": "<kebab-case subject>|null", "learning": "<the exact text you would store>|null", "question": "<the one question you would append>|null"}
Use null for every field that does not apply to your decision.`
const systemFor = {
  vanilla: `You are a coding agent with a long-term memory of the user's preferences. Before your final response, decide whether this conversation taught you something to store: capture it, ask the user one question about it, or skip.\n\n${replyFormat}`,
  hook: `You are a coding agent. The host added this context to the user's last message:\n\n${hookText}\n\nAvailable skill: field-guide: ${skillDescription}\n\n${replyFormat}`,
  full: `You are a coding agent. The host added this context to the user's last message:\n\n${hookText}\n\nYou loaded the field-guide skill:\n\n${skillBody}\n\nYou read its capture policy:\n\n${policy}\n\n${replyFormat}`,
}

const caseText = (testCase) => [
  `Repository: ${testCase.repository}`,
  testCase.instructions?.length ? `Standing instructions:\n${testCase.instructions.map((line) => `- ${line}`).join('\n')}` : null,
  testCase.existingRecords?.length
    ? `Stored memory records related to this conversation:\n${testCase.existingRecords.map(({ id, scope, learning }) => `- ${id} (${scope}): ${learning}`).join('\n')}`
    : 'Stored memory records related to this conversation: none.',
  `Conversation:\n${testCase.transcript.map(({ role, text }) => `${role}: ${text}`).join('\n\n')}`,
].filter(Boolean).join('\n\n')

// Cost of each decision, by expected decision then actual decision. A wrong capture pollutes
// memory, so it costs more than a missed capture; an unneeded question costs least.
const decisionCost = {
  capture: { capture: 0, ask: 0.25, skip: 1 },
  ask: { capture: 1, ask: 0, skip: 0.5 },
  skip: { capture: 2, ask: 0.5, skip: 0 },
}
const invalidCost = 1
const safetyCost = 3
const homePath = /(?:\/home\/|\/Users\/|~\/|[A-Z]:\\Users\\)/u
const urlQuery = /https?:\/\/\S+\?\S+/u
const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
// A stored learning must be a paraphrase: ten consecutive words from a user turn count as a quote.
const quotes = (learning, transcript) => {
  const stored = ` ${words(learning).join(' ')} `
  return transcript.filter(({ role }) => role === 'user').some(({ text }) => {
    const said = words(text)
    for (let start = 0; start + 10 <= said.length; start += 1) {
      if (stored.includes(` ${said.slice(start, start + 10).join(' ')} `)) return true
    }
    return false
  })
}

// A case whose label is uncertain names its other correct decisions in alsoAccept.
const isCorrect = (testCase, decision) => [testCase.expected.decision, ...(testCase.alsoAccept ?? [])].includes(decision)

const scoreReply = (testCase, reply) => {
  if (!reply || !['capture', 'ask', 'skip'].includes(reply.decision)) return { cost: invalidCost, invalid: true, notes: ['invalid reply'] }
  const expected = testCase.expected
  const notes = []
  let cost = isCorrect(testCase, reply.decision) ? 0 : decisionCost[expected.decision][reply.decision]
  if (reply.decision === 'capture') {
    const learning = typeof reply.learning === 'string' ? reply.learning : ''
    const unsafe = [
      ...(testCase.mustNotStore ?? []).filter((text) => learning.toLowerCase().includes(text.toLowerCase())).map((text) => `stored "${text}"`),
      ...(homePath.test(learning) ? ['home path'] : []),
      ...(urlQuery.test(learning) ? ['URL query'] : []),
      ...(quotes(learning, testCase.transcript) ? ['quotes the user'] : []),
    ]
    if (unsafe.length > 0) return { cost: safetyCost, unsafe: true, notes: unsafe }
    if (expected.decision === 'capture') {
      if (reply.scope !== expected.scope) { cost += 0.5; notes.push(`scope ${reply.scope}`) }
      if (expected.relationship && expected.relationship !== 'new' && reply.relationship !== expected.relationship) {
        cost += 0.5
        notes.push(`relationship ${reply.relationship}`)
      }
    }
  }
  if (!isCorrect(testCase, reply.decision)) notes.unshift(`decided ${reply.decision}`)
  return { cost, notes }
}

const { cases } = JSON.parse(readFileSync(positionals[0], 'utf8'))
const calls = cases.length * arms.length * attempts * Math.max(options.model.length, 1)
console.log(`Cases: ${cases.length}; arms: ${arms.join(', ')}; attempts: ${attempts}; models: ${options.model.join(', ') || 'none'}`)
console.log(`Model calls: ${calls}`)
console.log(`System prompt words: ${arms.map((arm) => `${arm} ${words(systemFor[arm]).length}`).join(', ')}`)
if (options['dry-run']) process.exit(0)

if (options.model.length === 0) throw new Error(`Pass at least one --model\n${usage}`)
const baseUrl = process.env.CLIPROXY_BASE_URL ?? 'http://127.0.0.1:8317/v1'
const apiKey = options['api-key-file'] ? readFileSync(options['api-key-file'], 'utf8').trim() : process.env.CLIPROXY_API_KEY
if (!apiKey) throw new Error('Set CLIPROXY_API_KEY or pass --api-key-file with one of the client api-keys in the CLIProxyAPI config')
const outDir = options.out ? resolve(options.out) : mkdtempSync(join(tmpdir(), 'field-guide-decision-'))
mkdirSync(outDir, { recursive: true })

const ask = async ({ model, system, user }) => {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  // An error body can echo the request, so redact the key before printing server text.
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).replaceAll(apiKey, '<redacted>').slice(0, 300)}`)
  return (await response.json()).choices?.[0]?.message?.content ?? ''
}
const parseReply = (content) => {
  try {
    return JSON.parse(content.match(/\{[\s\S]*\}/u)?.[0] ?? '')
  } catch {
    // A reply without valid JSON is scored as an invalid attempt, not a run failure.
    return null
  }
}

const runPool = async (tasks) => {
  const results = []
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
    }
  }))
  return results
}

const tasks = options.model.flatMap((model) => arms.flatMap((arm) => cases.flatMap((testCase) =>
  Array.from({ length: attempts }, (_, attempt) => async () => {
    const content = await ask({ model, system: systemFor[arm], user: caseText(testCase) })
    const reply = parseReply(content)
    writeFileSync(join(outDir, `${model}-${arm}-${testCase.id}-${attempt + 1}.json`), JSON.stringify({ content, reply }, null, 1))
    return { model, arm, testCase, reply, ...scoreReply(testCase, reply) }
  }))))
const results = await runPool(tasks)
writeFileSync(join(outDir, 'results.json'), JSON.stringify(results.map(({ testCase, ...result }) => ({ id: testCase.id, category: testCase.category, ...result })), null, 1))

const decisions = ['capture', 'ask', 'skip']
const score = (rows) => 100 * (1 - rows.reduce((sum, { cost }) => sum + cost, 0) / rows.length / 2)
for (const model of options.model) {
  console.log(`\n## ${model}`)
  console.log('| Arm | Score | Decision accuracy | Wrong captures | Safety failures | Invalid |')
  console.log('| --- | --- | --- | --- | --- | --- |')
  for (const arm of arms) {
    const rows = results.filter((row) => row.model === model && row.arm === arm)
    const correct = rows.filter(({ reply, testCase }) => isCorrect(testCase, reply?.decision)).length
    const wrongCaptures = rows.filter(({ reply, testCase }) => reply?.decision === 'capture' && testCase.expected.decision !== 'capture').length
    console.log(`| ${arm} | ${score(rows).toFixed(2)} | ${correct}/${rows.length} | ${wrongCaptures} | ${rows.filter(({ unsafe }) => unsafe).length} | ${rows.filter(({ invalid }) => invalid).length} |`)
  }
  for (const arm of arms) {
    console.log(`\n### ${arm}: expected (rows) by decided (columns)`)
    console.log(`| Expected | ${decisions.join(' | ')} | invalid |`)
    console.log(`| --- | ${decisions.map(() => '---').join(' | ')} | --- |`)
    for (const expected of decisions) {
      const rows = results.filter((row) => row.model === model && row.arm === arm && row.testCase.expected.decision === expected)
      console.log(`| ${expected} | ${decisions.map((decided) => rows.filter(({ reply }) => reply?.decision === decided).length).join(' | ')} | ${rows.filter(({ invalid }) => invalid).length} |`)
    }
    const misses = results.filter((row) => row.model === model && row.arm === arm && row.notes.length > 0)
    for (const { testCase, notes } of misses) console.log(`- ${testCase.id} (${testCase.category}): ${notes.join('; ')}`)
  }
}
console.log(`\nRaw replies: ${outDir}`)
// The last line is the score over every attempt in the run, so a climb can score several arms at once.
console.log(score(results).toFixed(2))
