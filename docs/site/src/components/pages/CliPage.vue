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
      description: "Shows the applied and repository commits, then each target's state.",
    },
    {
      command: "filip-stack apply",
      description:
        "Writes the setup and imports your preferences dotfile if it exists.",
    },
    {
      command: "filip-stack update",
      description:
        "On <code>main</code>: runs <code>git pull --ff-only</code>, then apply, then <code>field-guide-sync</code> if your preferences dotfile exists.",
    },
    {
      command: "filip-stack field-guide-sync",
      description:
        "Imports the preferences dotfile if present, then exports this machine's shared preferences to it.",
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
      description: "<code>~/.codex</code>: agent profiles and <code>rules/filip-stack.rules</code>.",
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
      Use the CLI to set up or update a machine's global guidance, agent
      profiles, output styles, and design language.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Needs</dt>
        <dd>Git and Node.js 20.16+</dd>
      </div>
      <div>
        <dt>Runs from</dt>
        <dd>A checkout of filip-stack; <code>update</code> needs <code>main</code></dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="install">
    <h2 id="install">Install</h2>
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
            If <code>~/.local/bin</code> is not on your <code>PATH</code>,
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
    </ol>
    <p class="hint">
      Without the link, run <code>node scripts/host-config.mjs &lt;command&gt;</code>
      from the checkout, such as <code>node scripts/host-config.mjs status</code>.
    </p>
  </section>

  <section aria-labelledby="writes">
    <h2 id="writes">Apply the setup</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>Inspect the applied and repository commits and each target's state.</p>
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
          <p>Write the setup to this machine.</p>
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
      The manifest at <code>~/.agents/.filip-stack-host-config.json</code>
      records the applied commit and file hashes. Apply removes previously
      managed files when the repository removes them.
    </p>
  </section>

  <section aria-labelledby="update">
    <h2 id="update">Keep up to date</h2>
    <p>
      Host config ships from <code>main</code> without a version. Run
      <code>filip-stack update</code> to pull and apply changes.
    </p>
    <p class="hint">
      On another branch or a detached HEAD, <code>update</code> stops before
      pulling or applying. Switch the checkout to <code>main</code>, or use
      <code>apply</code> to apply its current contents.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Sync your Field Guide preferences</h2>
    <p class="section-intro">
      The repository ships no preferences. To share yours between machines,
      sync this dotfile with your dotfile manager.
    </p>
    <dl class="fg-site-definitions">
      <dt><code>~/.config/filip-stack/field-guide.json</code></dt>
      <dd>
        With <code>$XDG_CONFIG_HOME</code> set and nonempty, the file is
        <code>filip-stack/field-guide.json</code> in that folder instead.
      </dd>
    </dl>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>On a machine with preferences to keep, export them.</p>
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
          <p>Add the file to your dotfile manager, such as chezmoi. Use your configured path.</p>
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
            On other machines, restore the dotfile, then run
            <code>filip-stack apply</code> to import it. Without it, apply
            prints its expected path and continues.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            For later updates, pull your dotfiles first. After
            <code>update</code> syncs preferences, save the changed dotfile back.
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
      Pulling first lets the sync merge other machines' preferences.
      <code>chezmoi re-add</code> updates chezmoi's own copy of the file.
    </p>
  </section>

  <section aria-labelledby="edits">
    <h2 id="edits">Recover from a local edit</h2>
    <div class="prose">
      <p>If managed text changed locally, apply prints the diff and stops. Choose one:</p>
      <ul>
        <li>
          Move the change into <code>host-config/</code>, commit it, and rerun apply
          to share it across machines.
        </li>
        <li>
          Rerun apply with <code>--force</code> to save the local file as
          <code>&lt;file&gt;.bak</code> and overwrite it.
        </li>
      </ul>
      <p>
        An existing, nonempty guidance file without a managed block also counts as edited.
        After forcing, restore machine-local text from the backup below the block.
      </p>
      <p>
        Keep machine-local notes below the marked block in <code>CLAUDE.md</code>
        or <code>AGENTS.md</code>. They stay in place and override conflicting shared guidance.
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
      <code>apply --force</code> and <code>update --force</code> back up and
      overwrite managed local edits. Use <code>--home &lt;dir&gt;</code> to
      target another home directory.
    </p>
  </section>

  <nav class="pager" aria-label="Pages">
    <a href="/filip-stack/"><span>Previous</span>Overview</a>
    <a href="/filip-stack/design-language/"><span>Next</span>Design language</a>
  </nav>
</template>
