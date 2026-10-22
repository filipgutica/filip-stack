# Component Libraries and Testing

## SFC and Component Style

- Follow the style default and project-override rules in [the entrypoint](../SKILL.md).
- Use PascalCase component filenames.
- Match nearby package conventions for props, emits, styles, test helpers, and naming.
- Keep route/page/root components as composition surfaces when a feature has multiple UI or state concerns.

## Component Libraries

- Treat sandboxes, README examples, and demo pages as part of the API communication surface.
- Keep examples aligned with the intended public API, not an internal convenience.
- Keep reusable logic in package-local composables when it improves readability or testability.
- Follow the package's existing export boundaries; keep implementation-only composables private.
- Avoid over-abstracting small one-off UI behavior.

## i18n

- Follow the local package or app `useI18n` pattern.
- Avoid hardcoded visible strings in package components when the package has local locale support.
- In tests, mock i18n at the same boundary the package already uses.

## Tests

- Use component tests for user-visible Vue behavior, slots, emits, model updates, and integration with UI libraries.
- Use unit tests for pure utilities and composables with meaningful state transitions.
- Keep test assertions focused on real contracts and user-observable behavior.
- Do not remove edge-case coverage while refactoring unless the test is demonstrably stale and the contract changed.
- Mock only the boundary (network/IO), not the component or composable under test; stubbing the unit itself lets a test pass without exercising real behavior.
- Cover the negative/error/empty path, not just the happy path — a component with a visible error state needs a test that triggers it.
- Avoid assertions that can't fail (`expect(wrapper).toBeTruthy()`) and snapshot-only tests with no behavioral assertion.
- `await nextTick()`/`await flushPromises()` before asserting on state that updates asynchronously; advance fake timers for debounce/throttle behavior.
- Choose mock cleanup by the state being isolated: `vi.clearAllMocks()` clears call history, `vi.resetAllMocks()` resets implementations as well, and `vi.restoreAllMocks()`/`restoreMocks: true` restores spied methods. Restoring spies does not reset standalone `vi.fn().mockResolvedValue(...)` implementations; reset those and re-establish each test's defaults when needed. Check the installed Vitest version's behavior. See [Vitest mock utilities](https://vitest.dev/api/vi.html#vi-resetallmocks).
- For Playwright, assert the user-visible outcome (rendered text, navigation, data shown), not just a 200 status or element existence; prefer auto-retrying `expect(locator).toHaveText/toBeVisible` over manual `waitForTimeout`.

## Anti-Patterns and Patterns

Anti-pattern: sandbox examples use private convenience props that are not the intended public API.

```vue
<DataTable :internal-row-map="rowMap" />
```

Pattern: examples show the public contract a consumer should copy.

```vue
<DataTable
  :rows="rows"
  :columns="columns"
/>
```

Anti-pattern: hardcoded visible strings in a package component with locale support.

```vue
<button>Save dashboard</button>
```

Pattern: follow the package i18n boundary.

```vue
<button>{{ t('dashboards.save') }}</button>
```

Anti-pattern: component test asserts implementation details instead of behavior.

```ts
expect(wrapper.vm.isDropdownOpen).toBe(true)
```

Pattern: assert the visible contract or emitted event.

```ts
await wrapper.find('[data-testid="filter-trigger"]').trigger('click')

expect(wrapper.find('[data-testid="filter-menu"]').exists()).toBe(true)
```

Anti-pattern: stubbing the component under test and asserting the mock instead of behavior.

```ts
vi.mock('./UserCard.vue', () => ({ default: { template: '<div />' } }))
const fetchUser = vi.fn().mockResolvedValue({ name: 'Ada' })

it('renders', () => {
  const wrapper = mount(UserCard, { props: { fetchUser } })
  expect(wrapper).toBeTruthy()
})
```

Pattern: mount the real component, mock only the network boundary, assert the rendered outcome.

```ts
const fetchUser = vi.fn().mockResolvedValue({ name: 'Ada' })

it('shows the user name after load', async () => {
  const wrapper = mount(UserCard, { props: { userId: 1, fetchUser } })
  await flushPromises()
  expect(wrapper.text()).toContain('Ada')
})
```
