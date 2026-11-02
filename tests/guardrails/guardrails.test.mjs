import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const pluginRoot = fileURLToPath(new URL('../../plugins/guardrails/', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const hookScript = join(pluginRoot, 'hooks/guardrails.mjs')
const hookCommand = JSON.parse(readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8')).hooks.PreToolUse[0].hooks[0].command

const claudeEnv = { CLAUDE_PLUGIN_ROOT: pluginRoot }
const codexEnv = { CLAUDE_PLUGIN_ROOT: pluginRoot, PLUGIN_ROOT: pluginRoot }

const runHook = ({ stdin, env = claudeEnv }) => {
  const result = spawnSync(process.execPath, [hookScript], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_ROOT: undefined, CLAUDE_PLUGIN_ROOT: undefined, ...env },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  return result.stdout
}

// Returns the permission decision for a Bash command, or null when the hook stays silent.
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

test('denies AI attribution in commit messages', () => {
  assertDecision([
    heredocCommit(claudeTrailer),
    `git commit --amend -m "fix: typo" -m "${codexTrailer}"`,
    `git commit -am 'feat: x' -m '${claudeTrailer.toLowerCase()}'`,
    `git -C repo commit -m $'feat: x\\n\\n${claudeTrailer}'`,
    `printf 'feat: x\\n\\n${claudeTrailer}\\n' | git commit -F -`,
    `git commit -F - <<< $'feat: x\\n\\n${claudeTrailer}'`,
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
    `gh api repos/o/r/issues/4/comments -f body='${claudeTrailer}'`,
    `gh api --method PATCH repos/{owner}/{repo}/pulls/12 -f body="Summary\n\n${claudeFooter}"`,
  ], 'deny')
})

test('denies AI attribution in message files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'guardrails-'))
  writeFileSync(join(dir, 'body.md'), `## Summary\n\n- adds a hook\n\n${claudeFooter}\n`)
  writeFileSync(join(dir, 'msg.txt'), `feat: x\n\n${codexTrailer}\n`)
  writeFileSync(join(dir, 'clean.md'), '## Summary\n\nMentions Co-Authored-By: Claude only mid-line.\n')
  assertDecision([
    'gh pr create --title "feat: x" --body-file body.md',
    `gh pr edit 12 --body-file=${join(dir, 'body.md')}`,
    'gh issue comment 4 -F body.md',
    'git commit -F msg.txt',
    'git commit --file=msg.txt',
    'gh api repos/o/r/issues/4/comments -F body=@body.md',
  ], 'deny', { cwd: dir })
  assertDecision([
    'gh pr create --title "feat: x" --body-file clean.md',
    'git commit -F missing.txt',
  ], null, { cwd: dir })
})

test('denies a message file written earlier in the same command', () => {
  assertDecision([
    `cat > msg.txt <<'EOF'\nfeat: x\n\n${claudeTrailer}\nEOF\ngit commit -F msg.txt`,
  ], 'deny')
})

test('allows commit and pull request text without AI attribution', () => {
  assertDecision([
    heredocCommit('Co-Authored-By: Jane Doe <jane@example.com>'),
    heredocCommit('This hook denies Co-Authored-By: Claude trailers.'),
    'git commit -m "docs: explain why Co-Authored-By: Claude trailers are denied"',
    'gh pr create --title "feat: guardrails" --body "Denies a whole-line Co-Authored-By: Claude trailer."',
    'git commit --amend --no-edit',
    `echo '${claudeTrailer}'`,
    `git log --grep '${claudeTrailer}'`,
  ], null)
})

test('asks before merging a pull request', () => {
  assertDecision([
    'gh pr merge 12 --squash',
    'gh pr merge',
    'gh api -X PUT repos/o/r/pulls/12/merge',
    'gh api --method PUT repos/{owner}/{repo}/pulls/12/merge -f merge_method=squash',
    'gh api -XPUT /repos/o/r/pulls/$PR/merge',
  ], 'ask')
  assertDecision([
    'gh pr view 12',
    'gh api repos/o/r/pulls/12/merge',
    'gh api -X PUT repos/o/r/pulls/12/requested_reviewers',
    // Quoted text passed to echo is data, not a command.
    'echo "gh pr merge 12"',
  ], null)
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
    'GH_TOKEN=x gh pr merge 12',
    'pnpm check && gh pr merge 12 --squash',
    'git status\ngh pr merge 12',
    '2>/dev/null op whoami',
    "cat <<'EOF'\nnotes\nEOF\nop whoami",
    'cat <<< "notes"\nop whoami',
  ], 'ask')
})

test('treats heredoc bodies as data', () => {
  assertDecision([
    "cat <<'EOF'\nop read op://v/i/f\ngh pr merge 12\nEOF",
  ], null)
})

test('finds commands inside shell wrappers', () => {
  for (const [name, wrap] of Object.entries(wrappers)) {
    assert.equal(decide(wrap('op read op://v/i/f'))?.permissionDecision, 'ask', name)
    assert.equal(decide(wrap('git status && gh pr merge 12'))?.permissionDecision, 'ask', name)
    assert.equal(decide(wrap(`git commit -m "feat: x" -m "${codexTrailer}"`))?.permissionDecision, 'deny', name)
    assert.equal(decide(wrap('grep op file && git commit -m "feat: x"')), null, name)
  }
})

test('Codex receives deny but no ask, which it does not support', () => {
  assert.equal(decide('gh pr merge 12', { env: codexEnv }), null)
  assert.equal(decide('op whoami', { env: codexEnv }), null)
  assert.equal(decide(heredocCommit(claudeTrailer), { env: codexEnv })?.permissionDecision, 'deny')
})

test('fails open on malformed input', () => {
  assert.equal(runHook({ stdin: 'not json' }), '')
  assert.equal(runHook({ stdin: JSON.stringify({ tool_name: 'Bash', tool_input: {} }) }), '')
  assert.equal(decide('git commit -m "unterminated'), null)
})

test('the manifest hook command runs for Claude and Codex', () => {
  const stdin = JSON.stringify({ tool_name: 'Bash', tool_input: { command: heredocCommit(claudeTrailer) } })
  for (const env of [claudeEnv, codexEnv]) {
    const result = spawnSync('/bin/sh', ['-c', hookCommand], {
      input: stdin,
      encoding: 'utf8',
      env: { ...process.env, PLUGIN_ROOT: undefined, CLAUDE_PLUGIN_ROOT: undefined, ...env },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny')
  }
})

test('both marketplaces list the plugin, and its payload stands alone', () => {
  const read = (path) => JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8'))
  assert.deepEqual(
    read('.claude-plugin/marketplace.json').plugins.find(({ name }) => name === 'guardrails'),
    { name: 'guardrails', source: './plugins/guardrails' },
  )
  assert.deepEqual(read('.agents/plugins/marketplace.json').plugins.find(({ name }) => name === 'guardrails')?.source, { source: 'local', path: './plugins/guardrails' })
  for (const file of readdirSync(pluginRoot, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())) {
    assert.doesNotMatch(readFileSync(join(file.parentPath, file.name), 'utf8'), /field-guide|workflow/iu, file.name)
  }
})
