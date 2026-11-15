<script setup lang="ts">
import { UiAlert, UiBreadcrumbs } from "@filipgutica/ui";
import { UiCommandList } from "@filipgutica/ui/site";
import HostCommands from "../HostCommands.vue";
const commands = {
  claude: "claude plugin install field-guide@filip-stack",
  codex: "codex plugin add field-guide@filip-stack",
  notice:
    'Field-guide: Activated shared guidance: "Prefer pnpm over npm." Say "undo that learning" to reverse it.',
};
const management = [
  {
    command: "/field-guide:field-guide audit",
    description: "Lists stored guidance without changing it.",
  },
  {
    command: "Say “undo that learning”",
    description: "Reverses the last saved learning.",
  },
];
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <UiBreadcrumbs
      :items="[{ label: 'Overview', href: '/filip-stack/' }, { label: 'Field Guide' }]"
    />
    <h1 id="title">Field Guide</h1>
    <p class="lede">
      Field Guide is an optional plugin that remembers your preferences and
      corrections. Tell your agent “Remember that I prefer pnpm over npm,” and
      later sessions know it too.
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
      Add the marketplace first, as the <a href="/filip-stack/">overview</a>
      shows. Then run the command for your agent.
    </p>
    <HostCommands :claude="commands.claude" :codex="commands.codex" />
    <p class="hint">
      The plugin adds hooks that run at session start and on each prompt.
      Codex runs them only after you review and trust them.
    </p>
  </section>

  <section aria-labelledby="first-use">
    <h2 id="first-use">Save your first preference</h2>
    <div class="prose">
      <p>Tell the agent something you want it to keep:</p>
      <blockquote><p>Remember that I prefer pnpm over npm.</p></blockquote>
      <p>
        The agent sets up <code>~/.field-guide</code> if it does not exist,
        saves a short paraphrase, and confirms in one line, for example:
      </p>
      <div class="code-scroll" tabindex="0" role="region" aria-label="Example notice">
        <pre><code>{{ commands.notice }}</code></pre>
      </div>
    </div>
    <p class="hint">
      In later sessions, the hooks bring it back when it matches the
      repository or your first prompt.
    </p>
  </section>

  <section aria-labelledby="manage">
    <h2 id="manage">See or undo what it saved</h2>
    <UiCommandList
      :items="management"
      :copyable="false"
      command-header="Do this"
      description-header="What happens"
    />
  </section>

  <section aria-labelledby="decide">
    <h2 id="decide">What it keeps</h2>
    <p class="section-intro">
      Before each final reply, the agent makes one of three choices.
    </p>
    <dl class="fg-site-definitions">
      <dt>Capture</dt>
      <dd>
        It saves a clear, lasting preference or correction and tells you in
        one line. This includes when to use a skill that runs only when you
        name it.
      </dd>
      <dt>Ask</dt>
      <dd>
        If the scope or wording is unclear, it asks you one question and saves
        nothing until you answer.
      </dd>
      <dt>Skip</dt>
      <dd>
        It saves nothing that is specific to one task, tentative, sensitive,
        or already covered by your instructions, the code, or a skill.
      </dd>
    </dl>
    <UiAlert tone="info"
      >It stores short paraphrases, never transcripts, prompts, credentials, or
      code dumps. Your current request and the live code always outrank what it
      remembers.</UiAlert
    >
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How it works</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>
            <strong>Session start.</strong> The hook adds up to eight stored
            records for the current repository, and a one-line list of other
            subjects the agent can look up.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>First prompt.</strong> The hook searches with your prompt
            and adds up to three matching records that are not already in
            context.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>Every prompt.</strong> The hook reminds the agent to
            choose capture, ask, or skip before its final reply. Nothing
            enforces that choice.
          </p>
        </div>
      </li>
    </ol>
    <p class="hint">
      After the first prompt, only the reminder repeats, until the next session
      start, <code>/clear</code>, or compaction. When the agent looks guidance up
      itself, the
      <a href="https://github.com/filipgutica/filip-stack/blob/main/plugins/field-guide/skills/field-guide/SKILL.md#retrieve-guidance">skill</a>
      has the exact rules.
    </p>
    <p class="hint">
      Local analytics are off until you turn them on. They record metadata
      only, never prompts or guidance text.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Advanced: share preferences between machines</h2>
    <div class="prose">
      <p>
        <code>filip-stack field-guide-sync</code> imports shared preferences
        from <code>~/.config/filip-stack/field-guide.json</code> if the file
        exists, then exports this machine's shared guidance to it. Sync that
        file between machines with your dotfile manager. The
        <a href="/filip-stack/cli/#sync">CLI page</a> has the setup.
      </p>
      <ul>
        <li>
          The file is under <code>$XDG_CONFIG_HOME</code> when that is set.
          <code>filip-stack apply</code> imports it only if it exists.
        </li>
        <li>
          An undo reaches other machines after they sync. It reverses only the
          replacement it undoes: a withdrawal, or another replacement of the
          same guidance, still wins.
        </li>
        <li>
          Refresh the Field Guide plugin and restart your agent before you run
          <code>filip-stack update</code>. An older plugin cannot read the
          newer store.
        </li>
      </ul>
    </div>
  </section>
</template>
