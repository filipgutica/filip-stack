<script setup lang="ts">
import { UiAlert, UiBreadcrumbs, UiCard } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
const tables = {
  files: [
    {
      command: "DESIGN.md",
      description:
        "Rules for choosing a format, styling the work, and checking the result.",
    },
    {
      command: "tokens.css",
      description: "Theme values to import or inline. The project hue and fonts sit in one block at the top.",
    },
    {
      command: "components.md",
      description: "One spec for each component, marked core or identity.",
    },
    {
      command: "components.html",
      description: "Every component in each state, in plain HTML and CSS.",
    },
    {
      command: "decisions.md",
      description: "Why each component looks the way it does, and the options it replaced.",
    },
    {
      command: "docs.html",
      description: "Example documentation shell with a compact setup command.",
    },
    {
      command: "product.html",
      description: "Example product page hierarchy.",
    },
    {
      command: "reference.html",
      description: "Example application and the foundations catalogue.",
    },
  ],
  formats: [
    {
      command: "Product page",
      description: "Purpose, one primary action, and a real product image.",
    },
    {
      command: "Docs or CLI tool",
      description: "The setup command or the information the task needs.",
    },
    {
      command: "Application",
      description: "Working content and its actions.",
    },
    {
      command: "Inline visual",
      description: "The comparison or explanation itself, in the host's theme.",
    },
  ],
};
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <UiBreadcrumbs
      :items="[{ label: 'Overview', href: '/filip-stack/' }, { label: 'Design system' }]"
    />
    <h1 id="title">Design system</h1>
    <p class="lede">
      The visual rules behind every interface Filip builds, written as plain
      HTML and CSS. Agents follow them for visual work, the Vue UI library
      implements them, and new apps start from them.
    </p>
    <UiAlert tone="info">
      <p>
        Browse the components on the
        <a href="https://filipgutica.github.io/design-system/components.html">design system site</a>.
      </p>
    </UiAlert>
    <dl class="fg-site-facts">
      <div>
        <dt>Installed to</dt>
        <dd><code>~/design-system</code></dd>
      </div>
      <div>
        <dt>Installed by</dt>
        <dd>
          <a href="/filip-stack/cli/"><code>filip-stack apply</code></a>
        </dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>
          <a href="https://github.com/filipgutica/design-system"><code>@filipgutica/design-system</code></a>
        </dd>
      </div>
      <div>
        <dt>Theme</dt>
        <dd>Graphite Indigo</dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="catalogue">
    <h2 id="catalogue">Component catalogue</h2>
    <div class="prose">
      <p>
        The catalogue shows every component in each state, using only
        <code>tokens.css</code>. Its markup sets the roles and states that
        every implementation copies:
        <a href="https://filipgutica.github.io/ui/"><code>@filipgutica/ui</code></a>
        in Vue, a React library, or a new app.
      </p>
      <ul>
        <li>
          <a href="https://filipgutica.github.io/design-system/components.html">Component catalogue</a>
        </li>
        <li>
          <a href="https://filipgutica.github.io/design-system/reference.html#foundations">Foundations</a>:
          type, color, spacing, shape, borders, elevation, focus, and motion.
        </li>
        <li>
          Examples:
          <a href="https://filipgutica.github.io/design-system/reference.html">application</a>,
          <a href="https://filipgutica.github.io/design-system/docs.html">documentation</a>, and
          <a href="https://filipgutica.github.io/design-system/product.html">product page</a>.
        </li>
        <li>
          <a href="https://github.com/filipgutica/design-system/blob/main/language/components.md">Component specs</a>
          and
          <a href="https://github.com/filipgutica/design-system/blob/main/language/decisions.md">decisions</a>
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How agents use it</h2>
    <div class="prose">
      <p>
        Agents read <code>~/design-system/DESIGN.md</code> before UX or visual
        work. It owns the look. For behavior, such as flows, states, copy, and
        accessibility, they also use the
        <a href="/filip-stack/skills/interface-design/">interface-design</a>
        skill.
      </p>
    </div>
    <ol class="fg-site-steps" aria-label="Which rules win">
      <li>
        <div>
          <p><strong>Your request</strong> wins.</p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>A repository's own design system</strong> owns its tokens
            and components.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong><code>filipgutica/design-system</code></strong> covers all
            other UX and visual work.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section aria-labelledby="formats">
    <h2 id="formats">Pick the format first</h2>
    <p class="section-intro">
      Choose the format first: it sets the density and what the
      reader sees first.
    </p>
    <UiCommandList
      :items="tables.formats"
      :copyable="false"
      command-header="Format"
      description-header="Lead with"
    >
      <template #description="{ item }"
        ><span v-html="item.description"
      /></template>
    </UiCommandList>
  </section>

  <section aria-labelledby="reuse">
    <h2 id="reuse">Reuse it in a new project</h2>
    <div class="prose">
      <p>
        The design system has two layers. A new project keeps the core as is:
        tokens, quiet depth, controls and their states, focus, motion, and
        accessibility. It replaces the identity layer: the personal sites'
        terminal look, with the <code>~/name</code> header, mono headings, and
        command plates.
      </p>
      <p>
        Keep <code>tokens.css</code> unchanged, and set your own hue and fonts
        on <code>:root</code> in a stylesheet loaded after it. Build
        components from the catalogue and specs.
      </p>
    </div>
  </section>

  <section aria-labelledby="theme">
    <h2 id="theme">Theme and token names</h2>
    <p class="section-intro">
      Graphite surfaces separate regions. Indigo marks primary actions; blue marks links.
      Focus is one indigo ring with a 3px gap. Use the header's appearance switch
      to compare light and dark.
    </p>
    <UiCard title="Graphite Indigo tokens">
      <template #actions>From <code>@filipgutica/ui</code></template>
      <div class="swatches">
        <figure>
          <span style="background: var(--color-bg)"></span>
          <figcaption><code>--color-bg</code>Page</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-surface)"></span>
          <figcaption><code>--color-surface</code>Regions</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-surface-raised)"></span>
          <figcaption><code>--color-surface-raised</code>Controls</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-text)"></span>
          <figcaption><code>--color-text</code>Body text</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-muted)"></span>
          <figcaption><code>--color-muted</code>Secondary</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-accent)"></span>
          <figcaption><code>--color-accent</code>Primary action</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-link)"></span>
          <figcaption><code>--color-link</code>Links</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-success)"></span>
          <figcaption><code>--color-success</code>State</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-warning)"></span>
          <figcaption><code>--color-warning</code>State</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-error)"></span>
          <figcaption><code>--color-error</code>State</figcaption>
        </figure>
      </div>
    </UiCard>
    <p class="hint">
      Labels are token names shared by standalone HTML and library sites.
      Values come from <code>tokens.css</code> in
      <code>@filipgutica/design-system</code>. <code>@filipgutica/ui</code>
      builds its themes from that package.
      <a href="https://filipgutica.github.io/ui/"
        >See the components in the UI library</a
      >.
    </p>
  </section>

  <section aria-labelledby="files">
    <h2 id="files">Rules and examples in the folder</h2>
    <UiCommandList
      :items="tables.files"
      :copyable="false"
      command-header="File"
      description-header="Use it for"
    >
      <template #description="{ item }"
        ><span v-html="item.description"
      /></template>
    </UiCommandList>
  </section>

  <section aria-labelledby="change">
    <h2 id="change">Where to make changes</h2>
    <div class="prose">
      <p>
        Edit the rules, examples, and tokens in
        <a href="https://github.com/filipgutica/design-system">filipgutica/design-system</a>,
        which publishes <code>@filipgutica/design-system</code>. filip-stack
        pins one version in
        <code>host-config/design-system.json</code>. After a release, bump the pin
        with <code>node scripts/pin-design-system.mjs &lt;version&gt;</code>, merge it,
        and run <code>filip-stack update</code> on each machine.
      </p>
    </div>
  </section>

</template>
