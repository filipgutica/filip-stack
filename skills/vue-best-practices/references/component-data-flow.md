# Component Data Flow

## Default Flow

- Use props down, events up as the default model.
- Use `v-model:prop` for true two-way component contracts, not just because a value changes.
- Use props plus emits for ordinary parent-owned updates that are not true model state.
- Keep host-owned state in the host. Components may own defaults, but persistence belongs to the consumer unless the API says otherwise.
- Avoid hidden coupling through module-level mutable state.

## Controlled and Uncontrolled State

- If a component accepts controlled state, keep update events and prop sync predictable.
- Avoid emitting while applying initial or externally controlled state unless that is the explicit contract.
- For partial config objects, make defaulting and normalization explicit.
- Use patch helpers for config updates when that keeps call sites readable and preserves equality checks.

## Provide and Inject

- Prefer props/events for local parent-child communication.
- Use provide/inject for deep tree dependencies, plugin-like context, or shared services where prop drilling would obscure intent.
- Type injection keys with `InjectionKey<T>`.
- Keep injected values stable and documented at the provider boundary.

## Data Fetching

- Keep fetch parameters derived from clear reactive sources.
- Guard duplicate fetches and stale responses when the UI can issue overlapping requests.
- Keep loading/error ownership explicit between parent and child.
- Tests should assert the fetcher contract, not implementation timing.

## Routing and Navigation Guards

- In Vue Router, return a route location to redirect or `false` to cancel; returning nothing, `undefined`, or `true` allows navigation. Prefer return-style guards. If using the legacy `next` argument, call it exactly once on each path; returning `next()` is not required.
- In Nuxt route middleware, return `navigateTo(...)` or `abortNavigation(...)` when redirecting or cancelling. Keep Nuxt middleware examples separate from Vue Router guards. See [Vue Router guards](https://router.vuejs.org/guide/advanced/navigation-guards.html) and [Nuxt middleware](https://nuxt.com/docs/4.x/guide/directory-structure/app/middleware).
- Await async work inside a guard (an auth check, a fetch) before letting navigation proceed.
- Guard forms with unsaved changes with `beforeRouteLeave`/`onBeforeRouteLeave` so navigating away doesn't silently drop user input.
- Never redirect to a user-supplied `?redirect=` URL without allow-listing it; that's an open redirect.
- A component reused across a param change (`/user/1` -> `/user/2`) does not re-run `setup()`. Watch the param (`watch(() => route.params.id, ...)`), or key the view (`<NuxtPage :page-key="route.fullPath" />` in Nuxt) when the component must reset.

## Anti-Patterns and Patterns

Anti-pattern: a Vue Router guard discards the redirect location.

```ts
router.beforeEach((to) => {
  if (to.path !== '/login' && !isAuthenticated(to)) {
    '/login' // a discarded route location does not redirect
  }
})
```

Pattern: return the redirect.

```ts
router.beforeEach((to) => {
  if (to.path !== '/login' && !isAuthenticated(to)) {
    return '/login'
  }
})
```

Anti-pattern: child component mutates parent-owned config through an object prop.

```ts
const props = defineProps<{ config: TableConfig }>()

const setPageSize = (pageSize: number) => {
  props.config.pageSize = pageSize
}
```

Pattern: emit an explicit update for parent-owned state.

```ts
const props = defineProps<{ config: TableConfig }>()
const emit = defineEmits<{
  (e: 'update:config', config: TableConfig): void
}>()

const setPageSize = (pageSize: number) => {
  emit('update:config', { ...props.config, pageSize })
}
```

Anti-pattern: using `v-model` only because a child reports a value change.

```vue
<DateRangePicker v-model:analytics-query="query" />
```

Pattern: reserve `v-model` for true model state; use events for ordinary actions.

```vue
<DateRangePicker
  :query="query"
  @apply="applyQuery"
/>
```

Anti-pattern: hidden module-level mutable state couples component instances.

```ts
let lastSelectedId: string | undefined

export function useSelectedRow() {
  const selectedId = ref(lastSelectedId)
  watch(selectedId, value => {
    lastSelectedId = value
  })

  return { selectedId }
}
```

Pattern: keep ownership explicit at the provider or host boundary.

```ts
const selectedId = ref<string>()

provide(selectedRowKey, readonly(selectedId))
```
