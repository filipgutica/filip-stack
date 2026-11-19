import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repositoryRoot } from './plugin-paths.mjs'

const clis = new Map()

/**
 * Returns the path of the Field Guide CLI at a commit, copied once from Git history into a
 * temporary directory. CI checks out full history, so released commits are present.
 */
export const cliAt = (commit) => {
  if (clis.has(commit)) return clis.get(commit)
  const directory = mkdtempSync(join(tmpdir(), 'field-guide-older-cli-'))
  for (const name of ['field-guide.mjs', 'field-guide-analytics.mjs']) {
    const shown = spawnSync('git', ['show', `${commit}:plugins/field-guide/skills/field-guide/scripts/${name}`], { cwd: fileURLToPath(repositoryRoot) })
    assert.equal(shown.status, 0, `commit ${commit} is missing; run git fetch --unshallow`)
    writeFileSync(join(directory, name), shown.stdout)
  }
  clis.set(commit, join(directory, 'field-guide.mjs'))
  return clis.get(commit)
}
