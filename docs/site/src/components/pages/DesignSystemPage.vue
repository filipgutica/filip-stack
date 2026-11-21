<script setup lang="ts">
import { UiAlert, UiBreadcrumbs, UiCard } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
import HostCommands from "../HostCommands.vue";
const commands = {
  claude:
    "claude plugin marketplace add filipgutica/design-system\nclaude plugin install design-system@design-system",
  codex:
    "codex plugin marketplace add filipgutica/design-system\ncodex plugin add design-system@design-system",
};
const tables = {
  files: [
    {
      command: "DESIGN.md",
      description:
        "Rules for choosing a format, styling UI, and checking the result.",
    },
    {
      command: "tokens.css",
      description:
        "CSS theme variables to import or inline, with hue and fonts at the top.",
    },
    {
      command: "components.md",
      description: "Spec for each component, marked core or identity.",
    },
    {
      command: "components.html",
      description: "Every component in every state, in plain HTML and CSS.",
    },
    {
      command: "decisions.md",
      description: "Why each component looks this way and what it replaced.",
    },
    {
      command: "docs.html",
      description: "Example docs layout with a compact setup command.",
    },
    {
      command: "product.html",
      description: "Example product page layout.",
    },
    {
      command: "reference.html",
      description: "Example app layout and foundations catalogue.",
    },
  ],
  formats: [
    {
      command: "Product page",
      description: "Purpose, one primary action, and a real product image.",
    },
    {
      command: "Docs or CLI tool",
      description: "The setup command or key task information.",
    },
    {
      command: "Application",
      description: "Working content and main actions.",
    },
    {
      command: "Inline visual",
      description: "The visual itself, styled in the host's theme.",
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
      Shared visual rules for Filip's interfaces, written in plain HTML and CSS.
      Agents follow them for visual work, the Vue UI library implements them,
      and new projects reuse them.
    </p>
    <UiAlert tone="info">
      <p>
        Agents use <code>filipgutica/design-system</code> by default through its
        <code>design-system</code> plugin. Browse components on the
        <a href="https://filipgutica.github.io/design-system/components.html">design system site</a>.
      </p>
    </UiAlert>
    <dl class="fg-site-facts">
      <div>
        <dt>Ships as</dt>
        <dd><code>design-system</code> plugin</dd>
      </div>
      <div>
        <dt>Agent skill</dt>
        <dd><code>$design-system:design-system</code></dd>
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

  <section aria-labelledby="install">
    <h2 id="install">Install the plugin</h2>
    <p class="section-intro">
      Host config does not install this plugin. Add it on machines that do
      visual work, or list design-system in your fleet plugin baseline before
      running filip-stack sync.
    </p>
    <HostCommands :claude="commands.claude" :codex="commands.codex" />
    <p class="hint">In Codex, restart to load the plugin.</p>
  </section>

  <section aria-labelledby="catalogue">
    <h2 id="catalogue">Component catalogue</h2>
    <div class="prose">
      <p>
        The catalogue renders every component and state using only plain HTML
        and <code>tokens.css</code>. Every implementation follows its markup and
        states:
        <a href="https://filipgutica.github.io/ui/"><code>@filipgutica/ui</code></a>,
        React, or a new app.
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
        <li>
          <a href="https://github.com/filipgutica/design-system/blob/main/language/visualizations.md">Data visualizations</a>:
          consistent measurements, filterable count reports, and self-contained HTML exports.
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How agents use it</h2>
    <div class="prose">
      <p>
        Before visual work, agents load <code>$design-system:design-system</code>,
        which reads <code>DESIGN.md</code> for appearance. For flows, states,
        copy, and accessibility, they pair it with
        <a href="/filip-stack/skills/interface-design/">interface-design</a>.
        Rules apply in this order:
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
            <strong>A repository's own design system</strong> controls its
            tokens and components.
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
      <li>
        <div>
          <p>
            <strong>Without the plugin</strong>, agents use no house style and
            note once that it is missing.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section aria-labelledby="formats">
    <h2 id="formats">Pick the format first</h2>
    <p class="section-intro">
      The skill picks one of four formats first to set density and lead content.
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
        The system has two layers. Keep the core layer unchanged (tokens, quiet
        depth, control states, focus, motion, and accessibility). Replace the
        identity layer, which gives Filip's personal sites their terminal look
        (<code>~/name</code> header, monospace headings, and command plates).
      </p>
      <p>
        Leave <code>tokens.css</code> unchanged. Override hue and fonts on
        <code>:root</code> in a stylesheet loaded after it, then build from the
        catalogue.
      </p>
    </div>
  </section>

  <section aria-labelledby="theme">
    <h2 id="theme">Theme and token names</h2>
    <p class="section-intro">
      Graphite surfaces separate regions. Indigo marks primary actions and blue
      marks links. Focus uses one indigo ring with a 3px gap. Toggle light and
      dark in the header.
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
      Standalone HTML and library sites share these CSS variable names from
      <code>tokens.css</code> in <code>@filipgutica/design-system</code>, which
      <code>@filipgutica/ui</code> builds its themes from.
      <a href="https://filipgutica.github.io/ui/">See the UI library</a>.
    </p>
  </section>

  <section aria-labelledby="files">
    <h2 id="files">Rules and examples in the plugin</h2>
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
        Edit rules, examples, and tokens in
        <a href="https://github.com/filipgutica/design-system">filipgutica/design-system</a>,
        which publishes <code>@filipgutica/design-system</code> and the
        <code>design-system</code> plugin. After a release, update with
        <code>claude plugin update design-system@design-system</code> (then
        start a new session or run /reload-plugins) or
        <code>codex plugin marketplace upgrade design-system</code> (then
        restart Codex).
      </p>
    </div>
  </section>

</template>
