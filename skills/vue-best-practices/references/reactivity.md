# Vue Reactivity

## Source State

- Keep source state small and explicit with `ref`, `shallowRef`, or `reactive`.
- Prefer `computed` for derived values instead of maintaining duplicate mutable state.
- Use `watch` for effects: fetching, syncing external APIs, emitting changes, resetting imperative libraries, and persistence.
- Avoid heavy derivation directly in templates when a named computed value improves readability.

## Props and Destructuring

- In Vue 3.5+, props destructured directly from `defineProps()` remain reactive within the same `<script setup>` block. Pass `toRef(() => prop)` when the composable expects a ref. On earlier versions, retain `props.foo` or use a compatible prop ref; wrapping an already non-reactive destructured value does not restore its connection.
- Avoid passing raw prop values into composables that need to react to future prop changes.
- Do not wrap every prop in `computed` by habit. Use `toRef(() => prop)` for readonly prop refs and `computed` when deriving a new value.

## Watches

- Watch the narrowest source that describes the side effect.
- Keep watcher callbacks small; move reusable or complex behavior to named functions.
- Avoid watchers that only assign one derived value from another. Use `computed` instead.
- Be explicit about `immediate` and `deep`; do not add them speculatively. Keep the default `flush` unless Watch Flush Timing below justifies a change.

## External Imperative APIs

- Keep opaque external handles such as grid APIs, observers, and controllers out of deep reactive proxies. Use `shallowRef` for replaceable handles, or `markRaw` when an object must remain unproxied inside a reactive graph. A normal `ref(object)` can proxy class instances and break identity checks or private-field access. See [shallowRef and markRaw](https://vuejs.org/api/reactivity-advanced.html).
- Isolate imperative updates behind named functions.
- Guard calls when handles may not be ready.
- When an external library mutates state, keep the Vue-facing source of truth clear and avoid circular sync loops.

## Watch Flush Timing

- Use the default flush timing. Do not use `{ flush: 'post' }`, `{ flush: 'sync' }`, `watchPostEffect`, or `watchSyncEffect` unless the non-default timing fixes a reproducible, documented issue. A test that fails with the default timing is the best evidence.
- When you use non-default flush timing, add a comment at the watcher. The comment must state the issue, why the default timing fails, and where the evidence is (test, issue, or doc).
- Default `flush: 'pre'` runs the callback before the component's DOM update. Non-default timing can be necessary when the callback reads DOM that depends on other reactive state that changed in the same tick.
- For a watcher observing a direct element template ref, Vue assigns non-null refs after rendering. That covers element availability, not every DOM-timing dependency: refs can become `null`, and DOM derived from other reactive state may still need post-flush timing. Check what the callback reads. See [template ref lifecycle](https://vuejs.org/guide/essentials/template-refs.html) and [watcher timing](https://vuejs.org/guide/essentials/watchers.html#callback-flush-timing).
- `{ immediate: true }` fires before mount; guard any DOM access on that first run.
- Set `immediate` and `deep` explicitly for the behavior the watcher needs; do not add them speculatively.

## Reactivity Across `await`

- In `<script setup>`, the compiler restores component context after a top-level `await`, so subsequent lifecycle registration can work. Top-level `await` produces async setup: plain Vue requires an ancestor `<Suspense>` for rendering; frameworks may provide their own integration. Check that boundary before introducing it. See [top-level await](https://vuejs.org/api/sfc-script-setup.html#top-level-await).
- In an ordinary `async setup()`, register lifecycle hooks and component-owned effects synchronously before the first `await`. Event handlers, watcher callbacks, and timers do not generally provide an active component instance or effect scope, even before an `await`; register lifecycle hooks during setup and explicitly own cleanup for effects created later.

## Effects That Write What They Read

- Keep computed getters, render expressions, and the query functions they call free of state mutations. Writes during derivation make dependencies and update order hard to reason about and can create feedback loops.
- `watch` and `watchEffect` are intended for side effects and may write reactive state. A write does not automatically cause recursion: loops depend on the tracked dependencies and scheduling. Avoid cycles that repeatedly change their own inputs.
- Put user-triggered writes in named actions and reactive synchronization in deliberate watchers. See [computed purity](https://vuejs.org/guide/essentials/computed.html#getters-should-be-side-effect-free) and [watch effects](https://vuejs.org/guide/essentials/watchers.html#watcheffect).

## Cleanup and Effect Scope

- Anything started in `onMounted` — `addEventListener`, `setInterval`/`setTimeout`, observers, subscriptions — must be torn down in `onUnmounted`, or use a VueUse auto-cleanup helper (`useEventListener`).
- Under `<KeepAlive>`, deactivation does not unmount the component. For effects that should run only while active, pause/tear down in `onDeactivated` and resume/re-arm in `onActivated`; make final cleanup safe as well.
- Watchers created synchronously in setup are disposed with the component. For effects created without an owning scope, explicitly own their lifetime: retain stop handles or group them in `effectScope().run(...)` and call `scope.stop()` when their owner ends. `onScopeDispose()` registers cleanup on an active scope; it does not stop that scope itself. See [effect scopes](https://vuejs.org/api/reactivity-advanced.html#effectscope).
- Capture and call manual stop handles (a `watch` stop function, a subscription's unsubscribe) on cleanup.

## Anti-Patterns and Patterns

Anti-pattern: storing derived state and keeping it synchronized by watch.

```ts
const rows = ref<Row[]>([])
const visibleRows = ref<Row[]>([])

watch(rows, () => {
  visibleRows.value = rows.value.filter(row => row.visible)
})
```

Pattern: derive values with `computed`.

```ts
const rows = ref<Row[]>([])
const visibleRows = computed(() => rows.value.filter(row => row.visible))
```

Anti-pattern: passing a raw prop value into a composable that must react to future changes.

```ts
const { status } = defineProps<{ status: string }>()

useStatusFilter(status)
```

Pattern: pass a readonly prop ref.

```ts
const { status } = defineProps<{ status: string }>()

useStatusFilter(toRef(() => status))
```

Anti-pattern: using a broad watcher with speculative options.

```ts
watch(
  () => props.config,
  () => refresh(),
  { deep: true, immediate: true },
)
```

Pattern: watch the narrow source that drives the side effect.

```ts
watch(
  () => props.config.query,
  () => refresh(),
)
```

Anti-pattern: a read-sounding function writes reactive state, and is reachable from a `computed`.

```ts
const checkItem = (data?: EntityData): boolean => {
  currentEntity.value = { ...data, path: data?.path || route.fullPath } // WRITE
  return items.value.some(f => f.path === currentEntity.value!.path)  // READ
}

// computed(() => checkItem(data)) mutates shared state during derivation.
// Whether a feedback loop occurs depends on the surrounding dependencies.
```

Pattern: keep the read pure; move the write to an intent-signaling action called only from an event handler.

```ts
const checkItem = (data?: EntityData): boolean => {
  const path = data?.path || route.fullPath
  return items.value.some(f => f.path === path) // no write to shared state
}

const onPageVisit = (data: EntityData) => {
  currentEntity.value = { ...data, path: data.path || route.fullPath }
}
```

Anti-pattern: a listener started on mount is never torn down.

```ts
onMounted(() => window.addEventListener('resize', onResize))
```

Pattern: tear down on unmount, or use the auto-cleanup helper.

```ts
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

// or
import { useEventListener } from '@vueuse/core'
useEventListener('resize', onResize)
```

VueUse's default window target is SSR-aware. An explicit `window` argument evaluated during server setup still throws; access browser globals inside mounted hooks or guarded client-only code. See [useEventListener](https://vueuse.org/core/useEventListener/).
