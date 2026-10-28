<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
const commands = {
  clone:
    "git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack",
  link: "mkdir -p ~/.local/bin\nln -s ~/code/filip-stack/scripts/host-config.mjs ~/.local/bin/filip-stack",
  path: "echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.zshrc\nsource ~/.zshrc",
  status: "filip-stack status",
  apply: "filip-stack apply",
  sync: "filip-stack field-guide-sync",
  chezmoi: "chezmoi add ~/.config/filip-stack/field-guide.json",
  routine: "chezmoi update\nfilip-stack update\nchezmoi re-add",
};
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
const tables = {
  reference: [
    {
      command: "filip-stack status",
      description: "Shows the applied commit, then each target's state.",
    },
    {
      command: "filip-stack apply",
      description:
        "Writes the targets. Imports your Field Guide preferences if that file exists.",
    },
    {
      command: "filip-stack update",
      description:
        "On <code>main</code> only: runs <code>git pull --ff-only</code>, then apply, then <code>field-guide-sync</code> when your preferences file exists.",
    },
    {
      command: "filip-stack field-guide-sync",
      description:
        "Syncs your shared Field Guide preferences with <code>~/.config/filip-stack/field-guide.json</code>.",
    },
  ],
  targets: [
    {
      command: "host-config/guidance/",
      description:
        "A marked block in <code>~/.claude/CLAUDE.md</code> and <code>~/.codex/AGENTS.md</code>. Text outside the block stays as it is.",
    },
    {
      command: "host-config/claude/",
      description:
        "<code>~/.claude</code>: agent templates (critic, explorer, reviewer, worker-high) and output styles.",
    },
    {
      command: "host-config/codex/",
      description: "<code>~/.codex</code>: Codex agent profiles.",
    },
    {
      command: "host-config/agents/",
      description:
        "<code>~/.agents/roles.md</code> and <code>~/.agents/CODING_STANDARDS.md</code>.",
    },
    {
      command: "host-config/design-language/",
      description:
        '<code>~/design-language</code>. See <a href="/filip-stack/design-language/">Design language</a>.',
    },
  ],
};
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <h1 id="title">filip-stack CLI</h1>
    <p class="lede">
      One command that applies the shared agent setup to this machine: global
      guidance, agent profiles, output styles, and the design language.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Needs</dt>
        <dd>Git and Node.js 20.16+</dd>
      </div>
      <div>
        <dt>Runs from</dt>
        <dd>A checkout of filip-stack on <code>main</code></dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="install">
    <h2 id="install">Install</h2>
    <p class="section-intro">
      The command runs from a checkout, because <code>update</code> pulls it. A
      link on your <code>PATH</code> is all it needs.
    </p>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>Clone the repository.</p>
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
          <p>Link the command onto your <code>PATH</code>.</p>
          <UiCodeBlock
            :code="commands.link"
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
            If <code>~/.local/bin</code> is not on your <code>PATH</code> yet,
            add it to <code>~/.zshrc</code> and reload your shell.
          </p>
          <UiCodeBlock
            :code="commands.path"
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
            Check that it works. It prints the applied commit, then the state of
            each target.
          </p>
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
          <p>Apply the setup.</p>
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
    <p class="hint">
      Without the link, run <code>node scripts/host-config.mjs</code> from the
      checkout.
    </p>
  </section>

  <section aria-labelledby="commands">
    <h2 id="commands">Commands</h2>
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
      <code>apply --force</code> and <code>update --force</code> overwrite
      managed local edits after saving a backup.
      <code>--home &lt;dir&gt;</code> applies the setup to another home
      directory.
    </p>
  </section>

  <section aria-labelledby="writes">
    <h2 id="writes">What apply writes</h2>
    <UiCommandList
      :items="tables.targets"
      :copyable="false"
      command-header="From the checkout"
      description-header="To"
    >
      <template #description="{ item }"
        ><span v-html="item.description"
      /></template>
    </UiCommandList>
    <p class="hint">
      A manifest in <code>~/.agents/.filip-stack-host-config.json</code> records
      the applied commit and a hash of each file. Apply removes a file it wrote
      earlier once the repository no longer has it.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Sync your Field Guide preferences</h2>
    <p class="section-intro">
      Preferences that apply on every machine live in one dotfile. The repo
      ships none, so a new machine starts empty.
    </p>
    <dl class="fg-site-definitions">
      <dt><code>~/.config/filip-stack/field-guide.json</code></dt>
      <dd>
        Your shared preferences. Uses <code>$XDG_CONFIG_HOME</code> when it is
        set.
      </dd>
    </dl>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>On a machine with preferences you want to keep, export them.</p>
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
          <p>Add the file to your dotfile manager, such as chezmoi.</p>
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
            On other machines, let your dotfile manager restore it, then run
            <code>filip-stack apply</code> to import it.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            From then on, pull your dotfiles before you update, and add the
            file back after. <code>update</code> syncs it for you.
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
      chezmoi keeps its own copy, so it sees a change only after
      <code>chezmoi re-add</code>. Pulling first lets the sync merge your other
      machines' preferences, so chezmoi has no conflict to report.
    </p>
  </section>

  <section aria-labelledby="edits">
    <h2 id="edits">If you edited a managed file</h2>
    <div class="prose">
      <p>Apply prints the diff and stops. Then choose one:</p>
      <ul>
        <li>
          Move the change into <code>host-config/</code> and commit it, so every
          machine gets it.
        </li>
        <li>
          Rerun with <code>--force</code>. Apply saves your file as
          <code>&lt;file&gt;.bak</code>, then overwrites it.
        </li>
      </ul>
      <p>
        Machine-local notes belong below the marked block in
        <code>CLAUDE.md</code> or <code>AGENTS.md</code>. They stay in place and
        override the shared guidance where they conflict.
      </p>
    </div>
  </section>

  <nav class="pager" aria-label="Pages">
    <a href="/filip-stack/"><span>Previous</span>Overview</a>
    <a href="/filip-stack/design-language/"><span>Next</span>Design language</a>
  </nav>
</template>
