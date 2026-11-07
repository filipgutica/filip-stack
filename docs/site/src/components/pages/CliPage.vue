<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
const commands = {
  clone:
    "git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack",
  install: "brew install filipgutica/tap/filip-stack",
  upgrade: "brew update\nbrew upgrade filipgutica/tap/filip-stack",
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
      command: "filip-stack --version",
      description: "Shows the installed CLI launcher's version.",
    },
    {
      command: "filip-stack status",
      description: "Shows applied and repository commits, then each target's state.",
    },
    {
      command: "filip-stack apply",
      description:
        "Writes setup and imports your preferences dotfile if present.",
    },
    {
      command: "filip-stack update",
      description:
        "On <code>main</code>: runs <code>git pull --ff-only</code>, then apply, then <code>field-guide-sync</code> if your preferences dotfile exists.",
    },
    {
      command: "filip-stack field-guide-sync",
      description:
        "Imports the preferences dotfile if present, then exports local shared preferences to it.",
    },
  ],
  targets: [
    {
      command: "host-config/guidance/",
      description:
        "A marked block in <code>~/.claude/CLAUDE.md</code> and <code>~/.codex/AGENTS.md</code>. Preserves text outside the block.",
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
      Set up or update a machine's global guidance, agent profiles, output
      styles, and design language.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Needs</dt>
        <dd>Git and Node.js 22.12+ (installed by Homebrew)</dd>
      </div>
      <div>
        <dt>Source checkout</dt>
        <dd>A separate checkout of filip-stack; <code>update</code> needs <code>main</code></dd>
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
      The checkout defaults to <code>~/code/filip-stack</code>. Elsewhere, use <code>filip-stack --repo &lt;dir&gt; &lt;command&gt;</code>.
      Without Homebrew, run <code>node scripts/host-config.mjs &lt;command&gt;</code>
      from the checkout, such as <code>node scripts/host-config.mjs status</code>.
    </p>
    <p class="hint">
      If <code>~/.local/bin/filip-stack</code> is an old symlink shadowing
      Homebrew, remove it. Check the active command with
      <code>command -v filip-stack</code>.
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
      records the applied commit and file hashes. Apply removes managed files
      removed from the repository.
    </p>
  </section>

  <section aria-labelledby="update">
    <h2 id="update">Keep up to date</h2>
    <p>
      Host config ships from <code>main</code> without a version. Run
      <code>filip-stack update</code> to pull and apply changes.
    </p>
    <p>Upgrade the CLI launcher separately with Homebrew:</p>
    <UiCodeBlock
      :code="commands.upgrade"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
    <p class="hint">
      <code>filip-stack --version</code> shows the launcher version.
      <code>filip-stack update</code> updates host config from the checkout.
    </p>
    <p class="hint">
      On another branch or detached HEAD, <code>update</code> stops before
      pulling or applying. Switch to <code>main</code>, or use
      <code>apply</code> for current checkout contents.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Sync your Field Guide preferences</h2>
    <p class="section-intro">
      The repository ships no preferences. Share yours between machines by
      syncing this dotfile with your dotfile manager.
    </p>
    <dl class="fg-site-definitions">
      <dt><code>~/.config/filip-stack/field-guide.json</code></dt>
      <dd>
        When <code>$XDG_CONFIG_HOME</code> is nonempty, use
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
          <p>Add your configured file path to your dotfile manager, such as chezmoi.</p>
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
            On other machines, restore the dotfile, then import with
            <code>filip-stack apply</code>. Without the file, apply prints its
            expected path and continues.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            For updates, pull dotfiles first. After <code>update</code> syncs
            preferences, save the changed dotfile back.
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
          Move the change into <code>host-config/</code>, commit, and rerun
          apply to share it across machines.
        </li>
        <li>
          Rerun apply with <code>--force</code> to save the local file as
          <code>&lt;file&gt;.bak</code> and overwrite it.
        </li>
      </ul>
      <p>
        Nonempty guidance files without managed blocks also count as edited.
        After forcing, restore machine-local text below the block from the
        backup.
      </p>
      <p>
        Keep machine-local notes below the marked block in
        <code>CLAUDE.md</code> or <code>AGENTS.md</code>. They survive apply
        and override conflicting shared guidance.
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
