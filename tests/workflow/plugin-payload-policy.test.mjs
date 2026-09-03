import assert from 'node:assert/strict'
import test from 'node:test'
import { isDevelopmentOnlyPluginPath } from '../../scripts/plugin-payload-policy.mjs'

test('runtime payload policy rejects development-only test assets', () => {
  const rejected = [
    'validate-contract.mjs',
    'skills/setup/scripts/validate-source-provenance-contract.mjs',
    'hooks/field-guide-lifecycle.test.mjs',
    'skills/example/example.spec.ts',
    'tests/example.mjs',
    'skills/example/test/fixture.json',
    'skills/example/__tests__/example.mjs',
    'skills/example/evaluations/scenarios.json',
  ]

  assert.deepEqual(rejected.filter((path) => !isDevelopmentOnlyPluginPath(path)), [])
})

test('runtime payload policy allows runtime guidance and utilities', () => {
  const allowed = [
    'skills/engineering/references/testing-and-debugging.md',
    'skills/engineering/references/verification-tools.md',
    'skills/planning/references/spec.md',
    'skills/walkthrough/references/presenter.md',
    'hooks/field-guide-lifecycle.mjs',
    'scripts/run-node.sh',
    'skills/field-guide/scripts/field-guide.mjs',
    'skills/field-guide/schemas/memory-v1.schema.json',
  ]

  assert.deepEqual(allowed.filter(isDevelopmentOnlyPluginPath), [])
})
