import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Creates a Git repository with one commit and a GitHub `origin` remote named after it. */
export const createRepo = ({ parent, name }) => {
  const repoRoot = join(parent, name)
  const git = (...args) => execFileSync('git', ['-C', repoRoot, ...args], { stdio: 'ignore' })
  execFileSync('git', ['init', repoRoot], { stdio: 'ignore' })
  git('config', 'user.name', 'Field Guide Test')
  git('config', 'user.email', 'field-guide@example.test')
  writeFileSync(join(repoRoot, 'README.md'), '# Test\n')
  git('add', 'README.md')
  git('commit', '-m', 'test: initialize repository')
  git('remote', 'add', 'origin', `git@github.com:example/${name}.git`)
  return repoRoot
}
