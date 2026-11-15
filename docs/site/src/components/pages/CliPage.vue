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
        "On <code>main</code>: <code>git pull --ff-only</code>, apply, then <code>field-guide-sync</code> if your preferences dotfile exists.",
    },
    {
      command: "filip-stack sync",
      description:
        "Applies this machine's fleet baseline and refreshes existing installations. Add <code>--dry-run --json</code> for a local preview.",
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
        "A marked block in <code>~/.claude/CLAUDE.md</code> and <code>~/.codex/AGENTS.md</code>. Text outside the block stays.",
    },
    {
      command: "host-config/claude/",
      description:
        "<code>~/.claude</code>: agent templates (critic, explorer, planner, reviewer, worker-high) and output styles.",
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
      The CLI gives each machine the same global agent guidance, agent
      profiles, and output styles, and keeps them current. It is optional.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Needs</dt>
        <dd>Git and Node.js 22.12+ (installed by Homebrew)</dd>
      </div>
      <div>
        <dt>Source checkout</dt>
        <dd>A separate checkout of filip-stack</dd>
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
      The CLI expects <code>~/code/filip-stack</code>. Elsewhere, run <code>filip-stack --repo &lt;dir&gt; &lt;command&gt;</code>.
      Without Homebrew, run <code>node cli/filip-stack.mjs --repo . &lt;command&gt;</code>
      from the checkout.
    </p>
    <p class="hint">
      If an old <code>~/.local/bin/filip-stack</code> symlink shadows Homebrew,
      remove it. <code>command -v filip-stack</code> shows which command runs.
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
      <code>~/.agents/.filip-stack-host-config.json</code> records the applied
      commit and file hashes. Apply removes files it applied earlier once the
      repository removes them.
    </p>
    <p class="hint">
      Apply no longer installs the design system; it ships as a plugin. See
      <a href="/filip-stack/design-system/">Design system</a>. Apply removes
      the unchanged files it put in <code>~/design-system</code> or
      <code>~/design-language</code>, and keeps files it did not install.
    </p>
  </section>

  <section aria-labelledby="update">
    <h2 id="update">Keep up to date</h2>
    <p>
      <code>filip-stack sync</code> refreshes this machine's guidance,
      standalone skills, and plugins. It needs a clean checkout
      that tracks <code>main</code>, keeps local guidance and extra installs,
      and reports conflicts. To sync every machine, use the <a href="/filip-stack/skills/fleet-sync/">Fleet Sync skill</a>.
    </p>
    <p>Update the CLI launcher with Homebrew:</p>
    <UiCodeBlock
      :code="commands.upgrade"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
    <p class="hint">
      Off <code>main</code>, including a detached HEAD, <code>update</code>
      stops before it pulls. Switch to <code>main</code>, or run
      <code>apply</code> to use the checkout as is.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Sync your Field Guide preferences</h2>
    <p class="section-intro">
      Share <a href="/filip-stack/field-guide/">Field Guide</a> preferences
      between machines by syncing this file with your dotfile manager.
    </p>
    <dl class="fg-site-definitions">
      <dt><code>~/.config/filip-stack/field-guide.json</code></dt>
      <dd>
        When <code>$XDG_CONFIG_HOME</code> is set and nonempty, it is
        <code>filip-stack/field-guide.json</code> there.
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
            On other machines, restore the dotfile, then run
            <code>filip-stack apply</code> to import it. Without it, apply
            prints its expected path and continues.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            For later updates, pull your dotfiles first so the sync merges
            other machines' preferences, then save the changed file back.
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
      <code>chezmoi re-add</code> updates chezmoi's own copy of the file.
    </p>
  </section>

  <section aria-labelledby="edits">
    <h2 id="edits">Recover from a local edit</h2>
    <div class="prose">
      <p>If you edited a managed file, apply prints the diff and stops. Either:</p>
      <ul>
        <li>
          Move the change into <code>host-config/</code>, commit it, and rerun
          apply.
        </li>
        <li>
          Rerun apply with <code>--force</code> to save the local file as
          <code>&lt;file&gt;.bak</code> and overwrite it.
        </li>
      </ul>
      <p>
        A nonempty guidance file without a managed block also counts as edited.
        After a forced apply, copy your machine-local text from the backup to
        below the block, where it wins over the shared guidance.
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
      <code>--force</code> backs up and overwrites managed local edits.
      <code>--home &lt;dir&gt;</code> targets another home directory.
    </p>
  </section>

</template>
