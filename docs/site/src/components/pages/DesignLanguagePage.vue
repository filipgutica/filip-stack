<script setup lang="ts">
import { UiCard } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
const tables = {
  files: [
    {
      command: "DESIGN.md",
      description:
        "The rules: format, type, color, spacing, components, motion, copy, and an acceptance checklist.",
    },
    {
      command: "tokens.css",
      description: "Theme values to import or inline in standalone HTML.",
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
      description: "Application components to copy, built only from tokens.",
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
    <h1 id="title">Design language</h1>
    <p class="lede">
      The visual rules Claude and Codex follow when they build pages, mockups,
      prototypes, charts, and explainers, so everything they make looks like it
      belongs together.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Installed to</dt>
        <dd><code>~/design-language</code></dd>
      </div>
      <div>
        <dt>Installed by</dt>
        <dd>
          <a href="/filip-stack/cli/"><code>filip-stack apply</code></a>
        </dd>
      </div>
      <div>
        <dt>Theme</dt>
        <dd>Graphite Indigo</dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How agents use it</h2>
    <div class="prose">
      <p>
        The shared guidance tells agents to read
        <code>~/design-language/DESIGN.md</code> before any UX or visual work.
        For interaction, flows, and states they also use the
        <a href="/filip-stack/skills/ux-laws/">ux-laws</a> skill.
        <code>DESIGN.md</code> owns the look; <code>ux-laws</code> owns the
        behavior.
      </p>
    </div>
    <ol class="fg-site-steps" aria-label="Which rules win">
      <li>
        <div>
          <p><strong>Your request</strong> wins over everything else.</p>
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
            <strong>The design language</strong> covers all other personal work.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section aria-labelledby="theme">
    <h2 id="theme">The theme</h2>
    <p class="section-intro">
      Quiet graphite surfaces, one indigo accent for actions, and blue for links
      and focus. Switch the appearance in the header to compare light and dark.
    </p>
    <UiCard title="Graphite Indigo tokens">
      <template #actions>From <code>@filipgutica/ui</code></template>
      <div class="swatches">
        <figure>
          <span style="background: var(--color-bg)"></span>
          <figcaption><code>--bg</code>Page</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-surface)"></span>
          <figcaption><code>--surface</code>Regions</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-surface-raised)"></span>
          <figcaption><code>--surface-raised</code>Controls</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-text)"></span>
          <figcaption><code>--text</code>Body text</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-muted)"></span>
          <figcaption><code>--text-muted</code>Secondary</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-accent)"></span>
          <figcaption><code>--accent</code>Primary action</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-link)"></span>
          <figcaption><code>--link</code>Links, focus</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-success)"></span>
          <figcaption><code>--success</code>State</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-warning)"></span>
          <figcaption><code>--warning</code>State</figcaption>
        </figure>
        <figure>
          <span style="background: var(--color-error)"></span>
          <figcaption><code>--danger</code>State</figcaption>
        </figure>
      </div>
    </UiCard>
    <p class="hint">
      The values live in <code>@filipgutica/ui</code>.
      <code>tokens.css</code> is a generated copy for standalone HTML.
      <a href="https://filipgutica.github.io/ui/"
        >See the components in the UI library</a
      >.
    </p>
  </section>

  <section aria-labelledby="files">
    <h2 id="files">What's in the folder</h2>
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

  <section aria-labelledby="formats">
    <h2 id="formats">Pick the format first</h2>
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

  <section aria-labelledby="change">
    <h2 id="change">Change it</h2>
    <div class="prose">
      <p>
        Edit the rules and examples in
        <code>host-config/design-language/</code> in filip-stack, then run
        <code>filip-stack apply</code> on each machine. Change theme values in
        <code>@filipgutica/ui</code> and regenerate <code>tokens.css</code>.
      </p>
    </div>
  </section>

  <nav class="pager" aria-label="Pages">
    <a href="/filip-stack/cli/"><span>Previous</span>filip-stack CLI</a>
    <a href="/filip-stack/field-guide/"><span>Next</span>Field Guide</a>
  </nav>
</template>
