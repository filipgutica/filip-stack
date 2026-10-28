<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock, UiAlert } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
const commands = {
  claude: "claude plugin install field-guide@filip-stack",
  codex: "codex plugin add field-guide@filip-stack",
};
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
const tables = {
  management: [
    {
      command: "Say “undo that learning”",
      description: "Reverses the last thing it saved.",
    },
    {
      command: "/field-guide:field-guide audit",
      description: "A read-only report on what's stored. Changes nothing.",
    },
    {
      command: "filip-stack field-guide-sync",
      description:
        'Syncs your shared preferences with <code>~/.config/filip-stack/field-guide.json</code>, which your dotfile manager carries between machines. See <a href="/filip-stack/cli/#sync">Sync your Field Guide preferences</a>.',
    },
  ],
};
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <h1 id="title">Field Guide</h1>
    <p class="lede">
      An optional plugin that remembers your durable preferences, corrections,
      and recurring lessons, and brings back the ones that match the work.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Stores in</dt>
        <dd><code>~/.field-guide</code>, local and untracked</dd>
      </div>
      <div>
        <dt>Hosts</dt>
        <dd>Claude Code and Codex</dd>
      </div>
      <div>
        <dt>Needed by</dt>
        <dd>Nothing. Workflow does not depend on it.</dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="install">
    <h2 id="install">Install</h2>
    <p class="section-intro">
      Add the marketplace first if you haven't, as on the
      <a href="/filip-stack/">overview</a>.
    </p>
    <div class="cmd-pair">
      <div>
        <p class="cmd-label">Claude Code</p>
        <UiCodeBlock
          :code="commands.claude"
          language="bash"
          variant="compact"
          :copyable="enhanced"
          :wrap="true"
        />
      </div>
      <div>
        <p class="cmd-label">Codex</p>
        <UiCodeBlock
          :code="commands.codex"
          language="bash"
          variant="compact"
          :copyable="enhanced"
          :wrap="true"
        />
      </div>
    </div>
    <p class="hint">
      Installing it turns on its session hooks. Leave it out to keep that
      context out of your sessions.
    </p>
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How it works</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>
            <strong>Session start.</strong> It adds up to eight stored records
            for the current repository, plus a one-line list of other subjects
            the agent can look up.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>First prompt.</strong> It uses your prompt as a search and
            adds up to three matching records that are not already in context.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>Before each final reply.</strong> The agent decides whether
            anything from the task is worth keeping.
          </p>
        </div>
      </li>
    </ol>
    <p class="hint">
      Later prompts get only that last reminder until the next session start,
      <code>/clear</code>, or compaction.
    </p>
  </section>

  <section aria-labelledby="decide">
    <h2 id="decide">What it keeps</h2>
    <dl class="fg-site-definitions">
      <dt>Capture</dt>
      <dd>
        A clear, durable correction or preference. It's saved, and the agent
        tells you in one line.
      </dd>
      <dt>Ask</dt>
      <dd>
        Something that might be durable, but the scope or wording is unclear.
        The agent asks one question and saves nothing until you answer.
      </dd>
      <dt>Skip</dt>
      <dd>
        Anything task-specific, tentative, sensitive, or already covered by your
        instructions or the code.
      </dd>
    </dl>
    <UiAlert tone="info"
      >It stores short paraphrases, never transcripts, prompts, credentials, or
      code dumps. Your current request and the live code always outrank anything
      it remembers.</UiAlert
    >
  </section>

  <section aria-labelledby="manage">
    <h2 id="manage">Manage what it remembers</h2>
    <UiCommandList
      :items="tables.management"
      :copyable="false"
      command-header="Do this"
      description-header="What happens"
    >
      <template #description="{ item }"
        ><span v-html="item.description"
      /></template>
    </UiCommandList>
    <p class="hint">
      The dotfile uses <code>$XDG_CONFIG_HOME</code> when set.
      <code>filip-stack apply</code> imports it only if it exists.
    </p>
    <p class="hint">
      Local analytics are off until you turn them on. They record metadata only,
      never prompts or guidance text.
    </p>
  </section>

  <nav class="pager" aria-label="Pages">
    <a href="/filip-stack/design-language/"
      ><span>Previous</span>Design language</a
    >
    <a href="/filip-stack/skills/engineering/"><span>Next</span>engineering</a>
  </nav>
</template>
