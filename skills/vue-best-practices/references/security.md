# Vue Security

## Core Rules

- Keep templates trusted. Never compile user-supplied strings as a component `template` or mount Vue onto server-rendered content containing untrusted HTML; template expressions execute JavaScript. Sanitizing `v-html` is a separate boundary and does not make untrusted templates safe. See [Vue's primary security rule](https://vuejs.org/guide/best-practices/security.html#rule-no-1-never-use-non-trusted-templates).
- Never bind untrusted or remote content to `v-html`. Sanitize with DOMPurify first, or render as text. Static/constant `v-html` is not a risk.
- Never bind an unvalidated URL to `:href`/`:src`. A `javascript:` URL or attacker-controlled destination enables injection/navigation attacks.
- Never bind user-controlled data to `:style` or `:class` wholesale. Malicious CSS can overlay elements for clickjacking. Bind only specific, enumerated properties (`:style="{ color: userColor }"`) or sanitize server-side.
- Add `rel="noopener noreferrer"` to any `target="_blank"` link to external content.
- Avoid persistent auth tokens in `localStorage`/`sessionStorage`, which injected scripts can read. Where the authentication architecture supports cookies, prefer server-set `HttpOnly`, `Secure` cookies with appropriate `SameSite` and CSRF defenses. Nuxt `useCookie()` is an SSR-aware API, not an automatic security boundary: `httpOnly` defaults to `false`, and client JavaScript cannot set or read an HttpOnly cookie. Follow the existing authentication contract rather than changing storage in isolation. See [Nuxt useCookie](https://nuxt.com/docs/4.x/api/composables/use-cookie).
- Never let secrets (API keys, tokens, credentials) reach client-executed code, client-bundled env vars, or error messages echoed back to the user.
- Validate `postMessage` origins. Protect mutating endpoints with CSRF defenses where cookies authenticate the request.

## Anti-Patterns and Patterns

Anti-pattern: rendering remote content unsanitized.

```vue
<div v-html="commentBody" />
```

Pattern: sanitize before rendering, or render as text.

```vue
<div v-html="sanitize(commentBody)" />
```

Anti-pattern: binding user-controlled style wholesale.

```vue
<div :style="user.profileStyles" />
```

Pattern: bind only the specific properties the UI needs.

```vue
<div :style="{ color: user.accentColor }" />
```

Anti-pattern: external link without `rel`.

```vue
<a :href="externalUrl" target="_blank">Visit</a>
```

Pattern: guard against reverse tabnabbing.

```vue
<a :href="externalUrl" target="_blank" rel="noopener noreferrer">Visit</a>
```

Anti-pattern: auth token kept in client-readable storage.

```ts
localStorage.setItem('authToken', token)
```

Pattern: keep the token in an httpOnly cookie set by the server.

```ts
// server sets an httpOnly, Secure cookie on login; client code never touches the token directly
```
