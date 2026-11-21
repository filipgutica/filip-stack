<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiBreadcrumbs, UiCodeBlock } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
const commands = {
  clone:
    "git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack",
  install: "brew install filipgutica/tap/filip-stack",
  upgrade: "brew update\nbrew upgrade filipgutica/tap/filip-stack",
  status: "filip-stack status",
  apply: "filip-stack apply",
  sync: "filip-stack field-guide-sync",
  chezmoi:
    "chezmoi add ~/.config/filip-stack/field-guide.json ~/.config/filip-stack/field-guide-annotations.json",
  routine: "chezmoi update\nfilip-stack update\nchezmoi re-add",
};
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
const tables = {
  reference: [
    {
      command: "filip-stack --version",
      description: "Shows the installed CLI launcher version.",
    },
    {
      command: "filip-stack status",
      description:
        "Shows the applied and checkout commits, plus each managed file's state.",
    },
    {
      command: "filip-stack apply",
      description:
        "Writes managed config files and imports your Field Guide preferences file if present.",
    },
    {
      command: "filip-stack update",
      description:
        "On <code>main</code> only: runs <code>git pull --ff-only</code>, <code>apply</code>, then <code>field-guide-sync</code> if your preferences file exists.",
    },
    {
      command: "filip-stack sync",
      description:
        "Installs missing baseline skills and plugins and refreshes existing guidance, skills, and plugins. Add <code>--dry-run --json</code> to preview.",
    },
    {
      command: "filip-stack field-guide-sync",
      description:
        "Imports your shared Field Guide preferences if present, then exports this machine's shared preferences.",
    },
  ],
  targets: [
    {
      command: "host-config/guidance.md",
      description:
        "Global guidance in <code>~/.agents/AGENTS.md</code>. A marked block in <code>~/.claude/CLAUDE.md</code> imports it, and one in <code>~/.codex/AGENTS.md</code> holds a copy. Text outside blocks stays.",
    },
    {
      command: "host-config/claude/",
      description:
        "<code>~/.claude</code>: agent templates (critic, explorer, planner, reviewer, worker-high) and output styles.",
    },
    {
      command: "host-config/codex/",
      description:
        "<code>~/.codex</code>: agent profiles and <code>rules/filip-stack.rules</code>.",
    },
    {
      command: "host-config/agents/",
      description:
        "<code>~/.agents/roles.md</code>, <code>CODING_STANDARDS.md</code>, and helper scripts in <code>scripts/</code>.",
    },
  ],
};
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <UiBreadcrumbs
      :items="[{ label: 'Overview', href: '/filip-stack/' }, { label: 'filip-stack CLI' }]"
    />
    <h1 id="title">filip-stack CLI</h1>
    <p class="lede">
      Apply shared global guidance, agent profiles, and output styles from a
      local checkout, and keep skills and plugins synced across machines.
      Optional.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Needs</dt>
        <dd>Git and Node.js 22.12+ (installed by Homebrew)</dd>
      </div>
      <div>
        <dt>Source checkout</dt>
        <dd>A local clone of filip-stack</dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="install">
    <h2 id="install">Install</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>Clone the repository and keep it on main.</p>
          <UiCodeBlock
            :code="commands.clone"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
      <li>
        <div>
          <p>Install the CLI with Homebrew.</p>
          <UiCodeBlock
            :code="commands.install"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
    </ol>
    <p class="hint">
      Default checkout: <code>~/code/filip-stack</code>. Elsewhere, pass
      <code>filip-stack --repo &lt;dir&gt; &lt;command&gt;</code> first. Without
      Homebrew, run
      <code>node cli/filip-stack.mjs --repo . &lt;command&gt;</code> from the
      checkout.
    </p>
    <p class="hint">
      Remove any old <code>~/.local/bin/filip-stack</code> symlink that
      overrides Homebrew. Check with <code>command -v filip-stack</code>.
    </p>
  </section>

  <section aria-labelledby="writes">
    <h2 id="writes">Apply the setup</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>Check what is applied now.</p>
          <UiCodeBlock
            :code="commands.status"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
      <li>
        <div>
          <p>Write the setup to your home directory.</p>
          <UiCodeBlock
            :code="commands.apply"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
    </ol>
    <UiCommandList
      :items="tables.targets"
      :copyable="false"
      command-header="From the checkout"
      description-header="What apply writes"
    >
      <template #description="{ item }"
        ><span v-html="item.description"
      /></template>
    </UiCommandList>
    <p class="hint">
      <code>~/.agents/.filip-stack-host-config.json</code> tracks applied file
      hashes. When the repository drops a managed file, the next apply removes
      it.
    </p>
    <p class="hint">
      Apply no longer installs the design system (see
      <a href="/filip-stack/design-system/">Design system</a>). It removes
      unchanged files from old <code>~/design-system</code> or
      <code>~/design-language</code> installs and keeps your own files.
    </p>
  </section>

  <section aria-labelledby="update">
    <h2 id="update">Keep up to date</h2>
    <p>
      Run <code>filip-stack sync</code> to install missing baseline skills and
      plugins and refresh existing guidance, skills, and plugins (or update for
      guidance and preferences only). Sync requires a clean <code>main</code>
      checkout with an upstream matching HEAD after a fast-forward pull. Local
      edits to managed home files block the guidance step, while local guidance
      and extra installs stay intact. For multiple machines, use
      <a href="/filip-stack/skills/fleet-sync/">Fleet Sync</a>.
    </p>
    <p>Upgrade the CLI launcher with Homebrew:</p>
    <UiCodeBlock
      :code="commands.upgrade"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
    <p class="hint">
      Off <code>main</code> (including detached HEAD), <code>update</code> stops
      before pulling. Switch to <code>main</code>, or run <code>apply</code>
      without pulling.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Sync your Field Guide preferences</h2>
    <p class="section-intro">
      Share <a href="/filip-stack/field-guide/">Field Guide</a> preferences
      across machines by syncing these two files with your dotfile manager.
    </p>
    <dl class="fg-site-definitions">
      <dt><code>~/.config/filip-stack/field-guide.json</code></dt>
      <dd>
        Shared preferences. When <code>$XDG_CONFIG_HOME</code> is set and
        nonempty, lives at <code>filip-stack/field-guide.json</code> there
        (substitute that path in the examples below).
      </dd>
      <dt><code>field-guide-annotations.json</code></dt>
      <dd>Same directory. Carries your confirmations and event tags.</dd>
    </dl>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>Export preferences on a machine that has them:</p>
          <UiCodeBlock
            :code="commands.sync"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
      <li>
        <div>
          <p>Track both files in your dotfile manager (such as chezmoi):</p>
          <UiCodeBlock
            :code="commands.chezmoi"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
      <li>
        <div>
          <p>
            On other machines, restore the dotfiles and run
            <code>filip-stack apply</code> to import them. If
            <code>field-guide.json</code> is missing, apply continues.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            For routine updates, pull dotfiles first so update merges changes
            from other machines, then save them back:
          </p>
          <UiCodeBlock
            :code="commands.routine"
            language="bash"
            variant="compact"
            :copyable="enhanced"
            :wrap="true"
          />
        </div>
      </li>
    </ol>
    <p class="hint">
      Bare <code>chezmoi re-add</code> saves every modified tracked file back
      into chezmoi. Pass both Field Guide file paths to re-add only those two
      files.
    </p>
  </section>

  <section aria-labelledby="edits">
    <h2 id="edits">Recover from a local edit</h2>
    <div class="prose">
      <p>If you edit a managed file locally, apply prints the diff and stops:</p>
      <ul>
        <li>
          Move the change into <code>host-config/</code>, commit it, and rerun
          apply.
        </li>
        <li>
          Rerun apply with <code>--force</code> to back up the local file as
          <code>&lt;file&gt;.bak</code> and overwrite it.
        </li>
      </ul>
      <p>
        A nonempty guidance file without a managed block also counts as edited.
        After a forced apply, paste machine-local rules below the block, where
        they override shared guidance.
      </p>
    </div>
  </section>

  <section aria-labelledby="commands">
    <h2 id="commands">Command reference</h2>
    <UiCommandList
      :items="tables.reference"
      :copyable="true"
      command-header="Command"
      description-header="What it does"
    >
      <template #description="{ item }"
        ><span v-html="item.description"
      /></template>
    </UiCommandList>
    <p class="hint">
      <code>--force</code> (apply, update) backs up and replaces or removes
      edited managed files. <code>--home &lt;dir&gt;</code> (non-sync) targets
      another home directory. Sync flags: --dry-run, --json, --config
      &lt;file&gt;, --environment-id &lt;id&gt;.
    </p>
  </section>

</template>
