import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'

const pluginRoot = fileURLToPath(new URL('../../plugins/guardrails/', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const hookScript = join(pluginRoot, 'hooks/guardrails.mjs')
const codexRules = join(repositoryRoot, 'host-config/codex/rules/filip-stack.rules')
const hookCommand = JSON.parse(readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8')).hooks.PreToolUse[0].hooks[0].command

const claudeEnv = { CLAUDE_PLUGIN_ROOT: pluginRoot }
const codexEnv = { CLAUDE_PLUGIN_ROOT: pluginRoot, PLUGIN_ROOT: pluginRoot }

// Runs a command with the hook's environment. The timeout makes a blocking file read fail fast.
const spawnHook = ({ file, args, stdin, env }) => {
  const result = spawnSync(file, args, {
    input: stdin,
    encoding: 'utf8',
    timeout: 3000,
    env: { ...process.env, PLUGIN_ROOT: undefined, CLAUDE_PLUGIN_ROOT: undefined, ...env },
  })
  assert.equal(result.signal, null, `hook timed out: ${stdin}`)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  return result.stdout
}

const runHook = ({ stdin, env = claudeEnv }) => spawnHook({ file: process.execPath, args: [hookScript], stdin, env })

// Returns the hook output for a Bash command, or null when the hook stays silent.
const decide = (command, { env, cwd = tmpdir() } = {}) => {
  const stdout = runHook({ stdin: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd }), env })
  if (stdout === '') return null
  const { hookSpecificOutput } = JSON.parse(stdout)
  assert.equal(hookSpecificOutput.hookEventName, 'PreToolUse')
  return hookSpecificOutput
}

const assertDecision = (commands, expected, options) => {
  for (const command of commands) {
    assert.equal(decide(command, options)?.permissionDecision ?? null, expected, command)
  }
}

const claudeTrailer = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
const codexTrailer = 'Co-Authored-By: Codex <noreply@openai.com>'
const claudeFooter = '🤖 Generated with [Claude Code](https://claude.com/claude-code)'

// The commit form Claude Code writes: a quoted heredoc inside a command substitution.
const heredocCommit = (lastLine) => [
  `git commit -m "$(cat <<'EOF'`,
  'feat(guardrails): add hook',
  '',
  "1) don't block quoted mentions",
  '2) keep the parser small',
  '',
  lastLine,
  'EOF',
  ')"',
].join('\n')

const wrappers = {
  'zsh -i -c': (script) => `zsh -i -c '${script}'`,
  'bash -c': (script) => `bash -c "${script.replaceAll('"', '\\"')}"`,
  'bash -lc': (script) => `bash -lc '${script}'`,
}

const fixtures = mkdtempSync(join(tmpdir(), 'guardrails-'))
after(() => rmSync(fixtures, { recursive: true, force: true }))
const fixture = (path, content) => {
  mkdirSync(join(fixtures, path, '..'), { recursive: true })
  writeFileSync(join(fixtures, path), content)
}
const fence = (content) => ['```text', content, '```'].join('\n')
fixture('body.md', `## Summary\n\n- adds a hook\n\n${claudeFooter}\n`)
fixture('msg.txt', `feat: x\n\n${codexTrailer}\n`)
fixture('sub/sub-msg.txt', `feat: x\n\n${claudeTrailer}\n`)
fixture('fenced.md', `## Summary\n\nAn example trailer:\n\n${fence(claudeTrailer)}\n`)
fixture('fenced-then-real.md', `## Summary\n\n${fence('example')}\n\n${claudeTrailer}\n`)
fixture('clean.md', '## Summary\n\nMentions Co-Authored-By: Claude only mid-line.\n')
fixture('body.json', JSON.stringify({ title: 'feat: x', body: claudeTrailer }))
fixture('bad.json', `{"body": "${claudeTrailer}"`)
fixture('fenced.json', JSON.stringify({ body: `Example:\n${fence(claudeTrailer)}` }))
fixture('other-field.json', JSON.stringify({ body: 'clean', note: `x\n${claudeTrailer}` }))
fixture('big.md', `${'x'.repeat(300 * 1024)}\n${claudeTrailer}\n`)
assert.equal(spawnSync('mkfifo', [join(fixtures, 'fifo')]).status, 0, 'mkfifo failed')

test('denies AI attribution in commit messages', () => {
  assertDecision([
    heredocCommit(claudeTrailer),
    `git commit --amend -m "fix: typo" -m "${codexTrailer}"`,
    `git commit -am "feat: x\n\n${claudeTrailer.toLowerCase()}"`,
    `git commit -m $'feat: x\\n\\n${claudeTrailer}'`,
    `git commit --message="feat: x\n\n${claudeTrailer}"`,
    `git commit --trailer "Co-authored-by: GitHub Copilot <copilot@github.com>" -m "feat: x"`,
    `git commit -m "feat: x" -m "Generated with Codex"`,
  ], 'deny')
})

test('the deny reason states the fix', () => {
  assert.match(decide(heredocCommit(claudeTrailer)).permissionDecisionReason, /Remove the AI attribution line\(s\) and retry\.$/u)
})

test('denies AI attribution in pull request and issue text', () => {
  assertDecision([
    `gh pr create --title "feat: x" --body "## Summary\n\n- adds a hook\n\n${claudeFooter}"`,
    `gh pr edit 12 -b 'Summary\n\nGenerated with Codex'`,
    `gh pr comment 12 --body=$'Done.\\n${codexTrailer}'`,
    `gh issue comment 4 --body "Fixed.\n${claudeFooter.replace('🤖 ', '')}"`,
    `gh issue create --title "bug" --body "Steps.\n${codexTrailer}"`,
    `gh issue edit 4 --body "Steps.\n${codexTrailer}"`,
    `gh -R o/r pr create --title t --body "${codexTrailer}"`,
    `gh api repos/o/r/issues/4/comments -f body='${claudeTrailer}'`,
    `gh api --method PATCH repos/{owner}/{repo}/pulls/12 -f body="Summary\n\n${claudeFooter}"`,
  ], 'deny')
})

test('denies attribution that reaches the write through stdin', () => {
  assertDecision([
    `printf 'feat: x\\n\\n${claudeTrailer}\\n' | git commit -F -`,
    `git commit -F - <<'EOF'\nfeat: x\n\n${claudeTrailer}\nEOF`,
    `git commit -F - <<< $'feat: x\\n\\n${claudeTrailer}'`,
    `cat <<'EOF' | gh pr create --title t --body-file -\nSummary\n\n${claudeFooter}\nEOF`,
  ], 'deny')
})

test('denies AI attribution in message files', () => {
  assertDecision([
    'gh pr create --title "feat: x" --body-file body.md',
    `gh pr edit 12 --body-file=${join(fixtures, 'body.md')}`,
    'gh issue comment 4 -F body.md',
    'gh issue edit 4 --body-file body.md',
    'git commit -F msg.txt',
    'git commit --file=msg.txt',
    'gh api repos/o/r/issues/4/comments -F body=@body.md',
    'gh pr create --title "feat: x" --body-file fenced-then-real.md',
  ], 'deny', { cwd: fixtures })
})

test('resolves message files from the git -C and cd directories', () => {
  assertDecision([
    'git -C sub commit -F sub-msg.txt',
    'cd sub && git commit -F sub-msg.txt',
    'cd sub; git add .; git commit -F sub-msg.txt',
  ], 'deny', { cwd: fixtures })
  assertDecision(['git commit -F sub-msg.txt', '(cd sub) && git commit -F sub-msg.txt'], null, { cwd: fixtures })
})

test('reads gh api --input JSON and fails open on bad input', () => {
  assertDecision([
    'gh api -X PATCH repos/o/r/pulls/12 --input body.json',
    'gh api -X PATCH repos/o/r/pulls/12 --input=body.json',
    `gh api -X PATCH repos/o/r/pulls/12 --input - <<'EOF'\n${JSON.stringify({ body: claudeTrailer })}\nEOF`,
  ], 'deny', { cwd: fixtures })
  assertDecision([
    'gh api -X PATCH repos/o/r/pulls/12 --input bad.json',
    'gh api -X PATCH repos/o/r/pulls/12 --input missing.json',
    'gh api -X PATCH repos/o/r/pulls/12 --input fenced.json',
    // Only the decoded body and title count, not other fields or the raw JSON text.
    'gh api -X PATCH repos/o/r/pulls/12 --input other-field.json',
  ], null, { cwd: fixtures })
})

test('skips files that are not small regular files', () => {
  assertDecision([
    'git commit -F fifo',
    'gh pr create --title t --body-file /dev/zero',
    'git commit -F big.md',
    'git commit -F missing.txt',
  ], null, { cwd: fixtures })
})

test('allows commit and pull request text without AI attribution', () => {
  assertDecision([
    heredocCommit('Co-Authored-By: Jane Doe <jane@example.com>'),
    heredocCommit('This hook denies Co-Authored-By: Claude trailers.'),
    'git commit -m "docs: explain why Co-Authored-By: Claude trailers are denied"',
    'gh pr create --title "feat: guardrails" --body "Denies a whole-line Co-Authored-By: Claude trailer."',
    'gh pr create --title "feat: x" --body-file fenced.md',
    'gh pr create --title "feat: x" --body-file clean.md',
    `gh pr create --title "feat: x" --body "Example:\n${fence(claudeTrailer)}"`,
    'git commit --amend --no-edit',
    `echo '${claudeTrailer}'`,
    `git log --grep '${claudeTrailer}'`,
  ], null, { cwd: fixtures })
})

test('inspects only the write command, not the rest of the script', () => {
  assertDecision([
    "git log --grep 'Co-Authored-By: Claude <noreply@anthropic.com>' && git commit -m 'fix: clean'",
    `echo '${claudeTrailer}'; git commit -m clean`,
    `printf '${claudeTrailer}\\n' > notes.txt && gh pr create --title t --body clean`,
  ], null)
})

test('uses stdin only when the write reads its message from stdin', () => {
  assertDecision([
    `printf '${claudeTrailer}\\n' | git commit -m clean`,
    `git commit -m clean <<'EOF'\n${claudeTrailer}\nEOF`,
    `git commit -m clean <<< '${claudeTrailer}'`,
    `printf '${claudeTrailer}\\n' | gh pr create --title t --body clean`,
  ], null)
})

const printfMessage = (...lines) => `$(printf '%s\\n' ${lines.map((line) => `'${line}'`).join(' ')})`

test('reads message text that a substitution produces', () => {
  assertDecision([
    `git commit -m "${printfMessage('feat: x', '', claudeTrailer)}"`,
    `gh pr create --title t --body "${printfMessage('Summary', '', claudeFooter)}"`,
    `git commit -F <(printf '%s\\n' 'feat: x' '' '${claudeTrailer}')`,
  ], 'deny')
  assertDecision([
    `git commit -m "${printfMessage('feat: x', '', 'Signed-off-by: Jane <jane@example.com>')}"`,
    // A substitution outside the message is unrelated.
    `git commit -m "fix: clean"; NOTE="${printfMessage(claudeTrailer)}"`,
  ], null)
})

test('closes a fence only on the same marker of at least the same length', () => {
  const bodyFromStdin = (body) => `gh pr create --title t --body-file - <<'EOF'\nExample:\n${body}\nEOF`
  const fourBackticks = ['````md', '```', claudeTrailer, '```', claudeTrailer, '````'].join('\n')
  const tildes = ['~~~', '```', claudeTrailer, '```', claudeTrailer, '~~~'].join('\n')
  assertDecision([bodyFromStdin(fourBackticks), bodyFromStdin(tildes)], null)
  assertDecision([bodyFromStdin(`${fourBackticks}\n${claudeTrailer}`), bodyFromStdin(`${tildes}\n${claudeTrailer}`)], 'deny')
})

test('reads a heredoc delimiter word whole and scans past an unclosed heredoc', () => {
  const op = 'op whoami'
  assertDecision([
    `cat <<E"OF"\nnotes\nEOF\n${op}`,
    `cat <<'E'OF\nnotes\nEOF\n${op}`,
    `cat <<E\\OF\nnotes\nEOF\n${op}`,
    `cat <<EOF\nnotes\n${op}`,
  ], 'ask')
  // A partly quoted delimiter still makes the body literal text.
  assertDecision(['cat <<E"OF"\n$(op whoami)\nEOF', 'cat <<E\\OF\n$(op whoami)\nEOF'], null)
})

// Merge authorization comes from the user's request, such as running full-send, not from a prompt.
test('stays silent on pull request merges', () => {
  const merges = ['gh pr merge 12 --merge', 'gh -R o/r pr merge 12', 'gh api -X PUT repos/o/r/pulls/12/merge']
  assertDecision(merges, null)
  assertDecision(merges, null, { env: codexEnv })
})

test('asks before a 1Password CLI call', () => {
  assertDecision([
    'op read op://vault/item/field',
    '/opt/homebrew/bin/op whoami',
    'env OP_ACCOUNT=me op item get x',
  ], 'ask')
  assertDecision([
    'grep op file',
    'optional --flag',
    'cat ops.txt',
    'echo op',
    'git commit -m "op: use the CLI later"',
  ], null)
})

test('finds commands after separators, substitutions, and assignments', () => {
  assertDecision([
    'true && op whoami',
    'false || op whoami',
    'cd repo; op whoami',
    'echo x | op inject',
    'TOKEN=$(op read op://v/i/f) npm publish',
    'export TOKEN="$(op read op://v/i/f)"',
    'TOKEN=`op read op://v/i/f` npm publish',
    '2>/dev/null op whoami',
    "cat <<'EOF'\nnotes\nEOF\nop whoami",
    'cat <<< "notes"\nop whoami',
    'cat <<EOF\nToken: $(op read op://v/i/f)\nEOF',
  ], 'ask')
})

test('treats quoted heredoc bodies as data', () => {
  assertDecision([
    "cat <<'EOF'\nop read op://v/i/f\n$(op whoami)\nEOF",
  ], null)
})

test('finds commands inside shell wrappers', () => {
  for (const [name, wrap] of Object.entries(wrappers)) {
    assert.equal(decide(wrap('op read op://v/i/f'))?.permissionDecision, 'ask', name)
    assert.equal(decide(wrap('git status && op whoami'))?.permissionDecision, 'ask', name)
    assert.equal(decide(wrap(`git commit -m "feat: x" -m "${codexTrailer}"`))?.permissionDecision, 'deny', name)
    assert.equal(decide(wrap('grep op file && git commit -m "feat: x"')), null, name)
  }
})

// Plain forms that the Codex execpolicy rule prompts for, so the hook stays silent on Codex.
const codexPlainForms = [
  ['op', 'read', 'op://vault/item/field'],
  ['op', 'whoami'],
]

test('Codex stays silent only for the plain forms its rule prompts for', () => {
  assertDecision(codexPlainForms.map((argv) => argv.join(' ')), null, { env: codexEnv })
  const unpromptable = [
    '/opt/homebrew/bin/op whoami',
    'GH_TOKEN=x op whoami',
    'pnpm check && op whoami',
    'op read op://v/i/f > secret.txt',
    'export TOKEN=$(op read op://v/i/f)',
    ...Object.values(wrappers).map((wrap) => wrap('op whoami')),
  ]
  for (const command of unpromptable) {
    const decision = decide(command, { env: codexEnv })
    assert.equal(decision?.permissionDecision, 'deny', command)
    assert.match(decision.permissionDecisionReason, /plain `op …` command/u, command)
  }
  assert.equal(decide(heredocCommit(claudeTrailer), { env: codexEnv })?.permissionDecision, 'deny')
})

const hasCodex = !spawnSync('codex', ['--version'], { encoding: 'utf8' }).error

test('the Codex execpolicy rule prompts for the plain forms', { skip: !hasCodex && 'codex is not installed' }, () => {
  for (const argv of codexPlainForms) {
    const result = spawnSync('codex', ['execpolicy', 'check', '--rules', codexRules, '--', ...argv], { encoding: 'utf8', timeout: 10000 })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).decision, 'prompt', argv.join(' '))
  }
})

test('fails open on malformed input', () => {
  assert.equal(runHook({ stdin: 'not json' }), '')
  assert.equal(runHook({ stdin: JSON.stringify({ tool_name: 'Bash', tool_input: {} }) }), '')
  assert.equal(decide('git commit -m "unterminated'), null)
})

test('the manifest hook command runs for Claude and Codex', () => {
  const stdin = JSON.stringify({ tool_name: 'Bash', tool_input: { command: heredocCommit(claudeTrailer) } })
  for (const env of [claudeEnv, codexEnv]) {
    const stdout = spawnHook({ file: '/bin/sh', args: ['-c', hookCommand], stdin, env })
    assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny')
  }
})

test('both marketplaces list the plugin', () => {
  const read = (path) => JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8'))
  assert.deepEqual(
    read('.claude-plugin/marketplace.json').plugins.find(({ name }) => name === 'guardrails'),
    { name: 'guardrails', source: './plugins/guardrails' },
  )
  assert.deepEqual(read('.agents/plugins/marketplace.json').plugins.find(({ name }) => name === 'guardrails')?.source, { source: 'local', path: './plugins/guardrails' })
})

test('the payload imports only Node built-ins and runs only its own files', () => {
  const scripts = readdirSync(pluginRoot, { recursive: true }).filter((path) => path.endsWith('.mjs'))
  assert.deepEqual(scripts, ['hooks/guardrails.mjs'])
  const specifiers = [...readFileSync(hookScript, 'utf8').matchAll(/^import .+ from '([^']+)'$/gmu)].map(([, specifier]) => specifier)
  assert.ok(specifiers.length > 0)
  assert.deepEqual(specifiers.filter((specifier) => !specifier.startsWith('node:')), [])
  const hookPaths = [...hookCommand.matchAll(/\}\}\/([^"]+)"/gu)].map(([, path]) => path)
  assert.deepEqual(hookPaths, ['scripts/run-node.sh', 'hooks/guardrails.mjs'])
  assert.ok(hookPaths.every((path) => existsSync(join(pluginRoot, path))))
})
