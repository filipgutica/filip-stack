// fallow-ignore-file unused-file -- loaded by the opt-in Field Guide invariant suite
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const { FG_FAULT_ROOT: root, FG_CRASH_AFTER, FG_DENY_JOURNAL, FG_CLOCK } = process.env
const crashAfter = Number(FG_CRASH_AFTER)
const storePath = (input) => {
  const path = input instanceof URL ? fileURLToPath(input) : input
  if (typeof path !== 'string') return false
  const name = relative(root, resolve(path))
  return name !== '' && name !== '..' && !name.startsWith(`..${sep}`)
}

let writes = 0
const counted = (method, paths) => {
  if (!paths.some(storePath)) return
  writes += 1
  fs.writeSync(2, `FG_WRITE ${writes} ${method} ${relative(root, resolve(paths.at(-1)))}\n`)
  if (writes === crashAfter) process.exit(86)
}

const deny = (paths) => {
  if (!FG_DENY_JOURNAL || !paths.some((path) => typeof path === 'string' && path.startsWith(`${root}/operations.jsonl`))) return
  throw Object.assign(new Error('EACCES: injected journal write failure'), { code: 'EACCES' })
}

// The CLI and hook use synchronous fs. Match any store path, including temporary and lock
// files, and count completed calls. An abrupt exit leaves both the files and lock as they were.
for (const [method, pathCount] of [
  ['writeFileSync', 1], ['appendFileSync', 1], ['renameSync', 2], ['copyFileSync', 2],
  ['unlinkSync', 1], ['linkSync', 2], ['rmSync', 1],
]) {
  const original = fs[method]
  fs[method] = (...args) => {
    const paths = args.slice(0, pathCount)
    deny(paths)
    const result = original(...args)
    counted(method, paths)
    return result
  }
}
syncBuiltinESMExports()

// Advance proposal/undo time without editing a run report, journal, or proposal on disk.
if (FG_CLOCK) {
  const RealDate = Date
  const now = Number(FG_CLOCK)
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
}
