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
    description:
      "Lists stored guidance without changing it (in Codex, use $field-guide:field-guide audit).",
  },
  {
    command: "Say “undo that learning”",
    description: "Reverses the last saved learning.",
  },
  {
    command: "Ask the agent to consolidate overlapping guidance",
    description:
      "Merges overlapping project records into one and gives an undo command.",
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
      Field Guide is an optional plugin that saves your preferences and
      corrections locally so you do not repeat them.
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
      Add the marketplace first (see the
      <a href="/filip-stack/">overview</a>), then install:
    </p>
    <HostCommands :claude="commands.claude" :codex="commands.codex" />
    <p class="hint">
      Adds hooks that run at session start, on each prompt, and after shell
      commands. In Codex, review and trust the hooks, then restart to load the
      plugin.
    </p>
  </section>

  <section aria-labelledby="first-use">
    <h2 id="first-use">Save your first preference</h2>
    <div class="prose">
      <p>Tell the agent what to remember:</p>
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
      Future sessions load it when it matches the repository or your first
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
        Some guidance covers a gated action your instructions normally ask about
        first, such as removing merged branches. For those records, the agent
        gives you an ID. Send a main-thread prompt containing only
        <code>confirm fg:&lt;id&gt;</code> to mark it <code>[confirmed]</code>.
      </p>
      <p>
        Only that exact prompt in a main thread confirms a record. Extra text,
        quoted IDs, pasted reports, and subagent or delegate prompts confirm
        nothing. No command creates a confirmation on its own, and agent
        guidance forbids the agent from sending one. Editing, withdrawing, or
        deleting the record removes its confirmation.
      </p>
    </div>
  </section>

  <section aria-labelledby="maintain">
    <h2 id="maintain">Keep the guide small</h2>
    <div class="prose">
      <p>
        Over time, several project records can overlap. Ask the agent to merge
        them into one record. You can undo any merge within 90 days, and undone
        merges are not suggested again.
      </p>
      <p>
        Merges never rewrite confirmed guidance automatically, and shared
        records are not merged yet. To approve a merge of confirmed records,
        send the exact <code>confirm fg:proposal:&lt;id&gt;</code> prompt the
        agent gives you. Nightly maintenance reviews overlaps and can apply
        reversible project merges and archives (90-day undo) without editing
        your instructions or skills. While confirmation history is intact, it
        never archives or merges any record you ever confirmed (even after
        unconfirming). It only flags or proposes changes for those protected
        records, and only flags other records when their subject holds a
        protected record. See the
        <a href="https://github.com/filipgutica/filip-stack/blob/main/plugins/field-guide/skills/field-guide/references/dreaming.md">maintenance reference</a>
        for exact rules.
      </p>
    </div>
  </section>

  <section aria-labelledby="decide">
    <h2 id="decide">What it keeps</h2>
    <p class="section-intro">
      Before each final reply, the agent chooses one of three actions:
    </p>
    <dl class="fg-site-definitions">
      <dt>Capture</dt>
      <dd>
        Saves a clear, lasting preference or correction (including when to use a
        manual-only skill) and shows a one-line notice.
      </dd>
      <dt>Ask</dt>
      <dd>
        If scope or wording is unclear, asks one question and waits to save.
      </dd>
      <dt>Skip</dt>
      <dd>
        Saves nothing that is task-specific, tentative, sensitive, or already in
        your instructions, code, or an automatic skill.
      </dd>
    </dl>
    <UiAlert tone="info"
      >Stores short paraphrases only, never transcripts, prompts, credentials,
      or code dumps. Your current request and live code always outrank stored
      guidance.</UiAlert
    >
  </section>

  <section aria-labelledby="how">
    <h2 id="how">How it works</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>
            <strong>Session start.</strong> Injects up to eight active records
            for this repository, plus a one-line list of other subjects to look
            up.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>First prompt.</strong> Searches with your prompt and injects
            up to three new matching records.
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            <strong>Every prompt.</strong> Reminds the agent to choose capture,
            ask, or skip before replying. Nothing enforces it.
          </p>
        </div>
      </li>
    </ol>
    <p class="hint">
      Only the reminder repeats until the next session start,
      <code>/clear</code>, or compaction (which restores earlier shared
      records). For manual lookups, see the
      <a href="https://github.com/filipgutica/filip-stack/blob/main/plugins/field-guide/skills/field-guide/SKILL.md#retrieve-guidance">skill</a>.
    </p>
    <p class="hint">
      Guidance can also be tagged for a merge, new pull request, or handoff.
      After a successful, recognized main-thread <code>gh pr merge</code> (once
      per named PR per session) or <code>gh pr create</code>, the hook injects
      up to three tagged records. Before handoff, the agent looks them up. Tags
      grant no extra authority.
    </p>
    <p class="hint">
      Local analytics are off by default and log metadata only, never prompts or
      guidance text.
    </p>
  </section>

  <section aria-labelledby="sync">
    <h2 id="sync">Advanced: share preferences between machines</h2>
    <div class="prose">
      <p>
        Sync <code>~/.config/filip-stack/field-guide.json</code> and
        <code>field-guide-annotations.json</code> with your dotfile manager. The
        second file carries confirmations and event tags.
        <code>filip-stack field-guide-sync</code> imports both, then exports
        shared guidance back. See the
        <a href="/filip-stack/cli/#sync">CLI page</a> for setup.
      </p>
      <ul>
        <li>
          Removing a confirmation on one machine revokes it everywhere after
          each machine syncs.
        </li>
        <li>
          If an older plugin modifies the store, its confirmations stop counting
          until you confirm again.
        </li>
        <li>
          Undoing a replacement reaches other machines after repeated syncs. It
          reverses only its own replacement, while withdrawals, archives, or
          other replacements of the same record still win.
        </li>
        <li>
          Update the Field Guide plugin and restart your agent before running
          <code>filip-stack update</code>, because older plugins cannot read
          newer stores.
        </li>
      </ul>
    </div>
  </section>
</template>
