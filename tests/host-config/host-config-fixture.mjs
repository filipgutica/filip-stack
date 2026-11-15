// Helpers for tests that run a copy of the host-config script against a temporary home.
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Copies the host-config script, its sources, and Field Guide into `repo`.
export const copyHostConfig = ({ repo }) => {
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  copyFileSync(new URL('../../scripts/host-config.mjs', import.meta.url), join(repo, 'scripts/host-config.mjs'))
  cpSync(new URL('../../host-config/', import.meta.url), join(repo, 'host-config'), { recursive: true })
  cpSync(new URL('../../plugins/field-guide/', import.meta.url), join(repo, 'plugins/field-guide'), { recursive: true })
}

// Lists every file under `directory` with its sha256, so a test can prove nothing changed.
export const snapshot = (directory) => (
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => [join(entry.parentPath, entry.name), createHash('sha256').update(readFileSync(join(entry.parentPath, entry.name))).digest('hex')])
    .sort(([left], [right]) => left.localeCompare(right))
)
