# Vue Composables

## When To Extract

Extract a composable when logic is reused, stateful, side-effect heavy, or makes a component hard to scan. Do not extract only to move five lines somewhere else.

Good extraction candidates:

- fetching and refresh lifecycles
- table/config/selection/pagination state
- browser or observer effects
- reusable form or validation state
- complex computed data pipelines

## Local Default Shapes

These are project ownership conventions, not an exhaustive list of valid Vue composable APIs. The examples below use these conventions; preserve other intentional contracts.

Prefer these shapes for feature/project composables:

- API-style composables return named domain operations as the primary API. They may keep local mutable refs internally and may expose owned readonly/computed coordination signals only when needed.
- Reactive-state composables accept `Readonly<Ref<T>>` or `ComputedRef<T>` inputs, own every ref, computed value, and local variable they create, and return readonly refs/computed values plus narrow domain actions by default.

Reactive-state composables may return owned mutable refs only when those refs are explicitly UI model state for child component `v-model`/`v-bind` binding. Treat that as part of the UI model contract, not permission for arbitrary caller mutation.

## API Shape

- Prefer parameter objects once a composable has three or more inputs or any optional/config-style inputs.
- Keep input names close to the caller's domain language.
- Keep return surfaces narrow. Return only what the component needs.
- Avoid exposing internal helpers that are only used to implement another returned function.

## Ref Inputs

- For internal project composables, prefer explicit `Readonly<Ref<T>>` inputs when the caller can pass refs.
- At component boundaries, pass reactive props with `toRef(() => prop)`.
- Getter inputs and `MaybeRefOrGetter` are valid for internal or public APIs when the caller contract benefits from them. Watch the ref/getter directly, or call `toValue()` inside the reactive effect.
- Prefer a readonly ref when it communicates the local contract more clearly; this is a project preference.

## Anti-Patterns and Patterns

Anti-pattern: mutating refs passed in by the caller.

```ts
export function useSelection({ selectedId }: { selectedId: Ref<string | undefined> }) {
  const selectRow = (id: string) => {
    selectedId.value = id
  }

  return { selectRow }
}
```

Pattern: receive readonly inputs, own local state, and return readonly outputs plus named actions.

```ts
export function useSelection({ rows }: { rows: Readonly<Ref<Row[]>> }) {
  const selectedId = ref<string>()
  const selectedRow = computed(() => rows.value.find(row => row.id === selectedId.value))

  const selectRow = (id: string) => {
    selectedId.value = id
  }

  return {
    selectedId: readonly(selectedId),
    selectedRow,
    selectRow,
  }
}
```

Anti-pattern: returning mutable internal refs for arbitrary caller mutation.

```ts
export function useRows() {
  const rows = ref<Row[]>([])

  return {
    rows,
    setRows: (nextRows: Row[]) => {
      rows.value = nextRows
    },
  }
}
```

Pattern: API-style composable returns named operations and owned readonly coordination state.

```ts
export function useDashboardApi() {
  const cacheKeyCounter = ref(0)
  const listCacheKey = computed(() => `${cacheKeyCounter.value}`)

  const refresh = () => {
    cacheKeyCounter.value += 1
  }

  const list = async () => {
    // fetch dashboards
  }

  return {
    list,
    refresh,
    listCacheKey,
  }
}
```

Anti-pattern: mixing caller-owned mutable state with internally owned mutable state so update ownership is unclear.

```ts
export function useFilters({ filters }: { filters: Ref<Filters> }) {
  const normalizedFilters = ref<Filters>()

  watch(filters, (nextFilters) => {
    normalizedFilters.value = normalizeFilters(nextFilters)
  })

  const reset = () => {
    filters.value = {}
    normalizedFilters.value = {}
  }

  return {
    normalizedFilters,
    reset,
  }
}
```

Pattern: return explicitly named owned model refs only for child `v-model`/`v-bind`.

```ts
export function useFilterModels() {
  const statusModel = ref<string>()
  const searchModel = ref('')

  return {
    statusModel,
    searchModel,
  }
}
```

Anti-pattern: state declared at module scope leaks across every caller of the composable.

```ts
// Module scope — shared by every component that calls useSelection()
const selectedId = ref<string>()

export function useSelection() {
  return { selectedId }
}
```

Pattern: declare state inside the function body so each caller gets its own instance.

```ts
export function useSelection() {
  const selectedId = ref<string>()
  return { selectedId }
}
```

## Boundaries

- Keep composables UI-agnostic unless the composable is intentionally tied to a component library.
- Keep component emits in the component when possible; pass narrow callbacks only when the composable owns the behavior that decides when to emit.
- Do not put unrelated concerns in one composable. Split by ownership: selection, pagination, fetching, column definitions, form state, etc.

## Instance State vs Module Scope

- Declare all per-instance state inside the composable function body. A `ref`/`reactive` declared at module scope (outside the function) is shared by every component that calls the composable — silent in dev and invisible in tests that mount only one instance, but two instances on the same page will silently share state.
- Use module scope only for an intentional singleton and document its lifetime. In SSR, modules can be reused across requests: keep user-specific mutable state in a per-request app/store/provider, not a module singleton. See [cross-request state pollution](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution).
