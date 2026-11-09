<script setup lang="ts">
import { UiAlert, UiCard } from "@filipgutica/ui";
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
      description: "Theme values to import or inline in standalone HTML. The project hue and fonts sit in one block at the top.",
    },
    {
      command: "components.md",
      description: "One spec for each component, marked core or identity.",
    },
    {
      command: "components.html",
      description: "Every component in each of its states, in plain HTML and CSS.",
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
      description: "Example application, and a catalogue of type, color, spacing, shape, borders, elevation, focus, and motion.",
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
      The framework-agnostic foundation for every interface Filip builds.
      Its tokens, components, and rules are plain HTML and CSS: the UI library
      implements them in Vue, new apps and libraries start from them, and
      Claude and Codex follow them for visual work.
    </p>
    <UiAlert tone="info">
      <p>
        filip-stack uses <code>filipgutica/design-system</code> as the default
        design system for UX and visual work, unless you ask for another or the
        repository has its own. Browse it on the
        <a href="https://filipgutica.github.io/design-system/">design system site</a>,
        or change it in the
        <a href="https://github.com/filipgutica/design-system">design-system repository</a>.
      </p>
    </UiAlert>
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
        The catalogue shows every component in each state that applies. It
        uses only <code>tokens.css</code>, and its markup carries the roles and
        states each implementation copies.
        <a href="https://filipgutica.github.io/ui/"><code>@filipgutica/ui</code></a>
        builds these components in Vue; a React library or a new app builds
        the same ones from here.
      </p>
      <ul>
        <li>
          <a href="https://filipgutica.github.io/design-system/components.html">Component catalogue</a>:
          each component and its states.
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
          <a href="https://github.com/filipgutica/design-system/blob/main/language/decisions.md">decisions</a>:
          what each component does, and why it looks the way it does.
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How agents use it</h2>
    <div class="prose">
      <p>
        The shared guidance tells agents to read
        <code>~/design-language/DESIGN.md</code> before UX or visual work.
        For interaction, flows, states, interface copy, and accessibility, they also use
        the <a href="/filip-stack/skills/interface-design/">interface-design</a>
        skill. <code>DESIGN.md</code> owns the look;
        <code>interface-design</code> owns the behavior and its checks.
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
            <strong><code>filipgutica/design-system</code></strong> is the
            default for all other UX and visual work. Use its palette, type, and
            components consistently across projects.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section aria-labelledby="formats">
    <h2 id="formats">Pick the format first</h2>
    <p class="section-intro">
      Choose the format before styling. It determines the density and what the
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
        The language has two layers. The core covers tokens, quiet depth,
        controls and their states, focus, motion, and accessibility, and a new
        project adopts it as is. The identity layer is the personal sites'
        terminal look: the <code>~/name</code> header, mono headings, and
        command plates. A new project replaces it with its own.
      </p>
      <p>
        To start, keep <code>tokens.css</code> unchanged and set your own hue
        and fonts on <code>:root</code> in a stylesheet loaded after it. Then
        build components from the catalogue and the component specs.
      </p>
    </div>
  </section>

  <section aria-labelledby="theme">
    <h2 id="theme">Theme and token names</h2>
    <p class="section-intro">
      Graphite surfaces separate regions. Indigo marks primary actions; blue marks links.
      Focus is one indigo ring with a 3px gap. Switch the appearance in the header
      to compare light and dark.
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
          <figcaption><code>--link</code>Links</figcaption>
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
      The labels above use standalone token names. The values live in <code>@filipgutica/ui</code>.
      <code>tokens.css</code> is a generated copy for standalone HTML.
      On library sites, use the first variable in each token's <code>ui:</code> comment.
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
        which publishes them as <code>@filipgutica/design-system</code>.
        filip-stack pins one published version in
        <code>host-config/design-system.json</code>. After a release, bump the pin
        with <code>node scripts/pin-design-system.mjs &lt;version&gt;</code>, merge it,
        then run <code>filip-stack update</code> on each machine.
      </p>
    </div>
  </section>

  <nav class="pager" aria-label="Pages">
    <a href="/filip-stack/cli/"><span>Previous</span>filip-stack CLI</a>
    <a href="/filip-stack/field-guide/"><span>Next</span>Field Guide</a>
  </nav>
</template>
