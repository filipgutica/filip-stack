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
  {
    command: "Ask the agent to consolidate overlapping guidance",
    description: "Merges records that say the same thing into one, and gives you an undo command.",
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
      corrections across sessions.
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
      After you add the marketplace, as the
      <a href="/filip-stack/">overview</a> shows, run:
    </p>
    <HostCommands :claude="commands.claude" :codex="commands.codex" />
    <p class="hint">
      The plugin adds hooks that run at session start, on each prompt, and
      after each shell command.
      Codex runs them after you review and trust them.
      In Codex, restart so a new session loads the plugin.
    </p>
  </section>

  <section aria-labelledby="first-use">
    <h2 id="first-use">Save your first preference</h2>
    <div class="prose">
      <p>Tell the agent what to keep:</p>
      <blockquote><p>Remember that I prefer pnpm over npm.</p></blockquote>
      <p>
        The agent creates <code>~/.field-guide</code> if needed, saves a short
        paraphrase, and confirms in one line:
      </p>
      <div class="code-scroll" tabindex="0" role="region" aria-label="Example notice">
        <pre><code>{{ commands.notice }}</code></pre>
      </div>
    </div>
    <p class="hint">
      Later sessions recall it when it matches the repository or your first
      prompt.
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

  <section aria-labelledby="confirm">
    <h2 id="confirm">Confirm guidance for a gated action</h2>
    <div class="prose">
      <p>
        Some guidance names an action that your instructions tell the agent to
        ask about first, such as removing merged branches. For that guidance,
        the agent offers an ID. Send a prompt that is exactly
        <code>confirm fg:&lt;id&gt;</code>, and the hook marks the guidance
        <code>[confirmed]</code> and shows you the text you confirmed.
      </p>
      <p>
        Only that prompt confirms. Extra text, a quoted ID, a pasted report, or
        a prompt in a delegate or subagent confirms nothing. No Field Guide
        command adds a confirmation on its own; import copies them from your
        synced file, which you trust, and applying a proposal you approved
        confirms its replacement only when a record it replaces was confirmed.
        A prompt that only mentions the command, such as a pasted report, shows
        you no notice.
        The hook cannot tell who sent the prompt, so the agent's guidance
        forbids it from sending one. Changing, withdrawing, or deleting the
        guidance removes the confirmation.
      </p>
    </div>
  </section>

  <section aria-labelledby="maintain">
    <h2 id="maintain">Keep the guide small</h2>
    <div class="prose">
      <p>
        Over time, several records can say the same thing. The agent can merge
        them into one record, and you can undo a merge for 90 days. If you
        undo a merge, it is not suggested again. A merge that would copy a
        home directory path into the new record, such as the identity of a
        repository without a remote, is refused.
      </p>
      <p>
        A merge never rewrites guidance you confirmed on its own. To accept
        one, send the exact <code>confirm fg:proposal:&lt;id&gt;</code> prompt
        the agent gives you. Shared guidance is not merged yet. Nightly
        maintenance lists overlapping records for a review, and can also apply
        merges, archives, and flags within the lifecycle rules; you can undo
        each merge and archive it applies for 90 days. It never archives or
        merges guidance you ever confirmed, even after you unconfirm it; it
        only flags or proposes it. It never edits your instructions
        or skills. The
        <a href="https://github.com/filipgutica/filip-stack/blob/main/plugins/field-guide/skills/field-guide/references/dreaming.md">maintenance reference</a>
        has the exact rules.
      </p>
    </div>
  </section>

  <section aria-labelledby="decide">
    <h2 id="decide">What it keeps</h2>
    <p class="section-intro">
      Before each final reply, the agent makes one of three choices.
    </p>
    <dl class="fg-site-definitions">
      <dt>Capture</dt>
      <dd>
        It saves a clear, lasting preference or correction, including when to
        use a manual-only skill, and tells you in one line.
      </dd>
      <dt>Ask</dt>
      <dd>
        If the scope or wording is unclear, it asks one question and waits to
        save.
      </dd>
      <dt>Skip</dt>
      <dd>
        It saves nothing that is specific to one task, tentative, sensitive,
        or already covered by your instructions, the code, or a skill.
      </dd>
    </dl>
    <UiAlert tone="info"
      >It stores short paraphrases, never transcripts, prompts, credentials, or
      code dumps. Your current request and the live code outrank what it
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
            and adds up to three new matching records.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>Every prompt.</strong> The hook reminds the agent to
            choose capture, ask, or skip before its final reply. Nothing enforces it.
          </p>
        </div>
      </li>
    </ol>
    <p class="hint">
      After the first prompt, only the reminder repeats, until the next session
      start, <code>/clear</code>, or compaction. Compaction also brings back
      the shared records the session had received. When the agent looks guidance up
      itself, the
      <a href="https://github.com/filipgutica/filip-stack/blob/main/plugins/field-guide/skills/field-guide/SKILL.md#retrieve-guidance">skill</a>
      has the rules.
    </p>
    <p class="hint">
      The agent can tag guidance for a merge, a new pull request, or a handoff.
      After a <code>gh pr merge</code> or <code>gh pr create</code> in the main
      thread, the hook adds up to three tagged records, once per named pull request.
      At a handoff, the agent looks the tagged guidance up. Tags only choose
      when guidance appears.
    </p>
    <p class="hint">
      Local analytics are off by default and record metadata only, never
      prompts or guidance text.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Advanced: share preferences between machines</h2>
    <div class="prose">
      <p>
        Sync <code>~/.config/filip-stack/field-guide.json</code> and
        <code>field-guide-annotations.json</code> beside it between machines
        with your dotfile manager. The second file carries confirmations and
        tags. <code>filip-stack field-guide-sync</code> imports both, then
        exports this machine's shared guidance to them. The
        <a href="/filip-stack/cli/#sync">CLI page</a> has the setup.
      </p>
      <ul>
        <li>
          A confirmation you remove on one machine is removed everywhere after
          each machine syncs.
        </li>
        <li>
          When an older Field Guide plugin changes your guidance, every
          confirmation in that store stops counting until you confirm again.
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
