<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock } from "@filipgutica/ui";
import SkillList from "../SkillList.vue";
import type { Catalog } from "../../catalog";
const { catalog } = defineProps<{ catalog: Catalog }>();
const skillsByName = new Map(
  [...catalog.workflow, ...catalog.standalone].map((skill) => [
    skill.name,
    skill,
  ]),
);
const skillNamed = (name: string) => {
  const skill = skillsByName.get(name);
  if (!skill) throw new Error(`The Workflow example names an unknown skill: ${name}`);
  return skill;
};
// One feature, one request per turn. Each `reads` entry mirrors a link in the
// picked skill's SKILL.md, with the condition that SKILL.md gives for reading it.
type Read = {
  file: string;
  /** The skill that owns the file, when it is not the picked skill. */
  from?: string;
  when: string;
};
type Turn = { request: string; skill: string; does: string; reads: Read[] };
const turns: Turn[] = [
  {
    request: "Write a spec for rate limiting on the public API.",
    skill: "planning",
    does: "It writes the spec from what the repository shows and changes no code. A public API is a public contract, so a separate reviewer critiques the spec before you get it.",
    reads: [
      { file: "spec.md", when: "the format for a specification" },
      {
        file: "technical-prose.md",
        from: "technical-writing",
        when: "the writing rules for the spec's text",
      },
    ],
  },
  {
    request: "Implement the spec and open a PR.",
    skill: "engineering",
    does: "It makes the smallest change that meets the spec and reruns the affected tests and checks. A public API change is risky, so a separate reviewer checks it before you get the PR. If none is available, it says so.",
    reads: [
      {
        file: "testing-and-debugging.md",
        when: "only if it is unclear how to reproduce or test the change",
      },
      {
        file: "delegation-and-review.md",
        when: "because a public API change needs a separate reviewer",
      },
      {
        file: "commit-and-pr-hygiene.md",
        when: "before it commits or opens the PR",
      },
    ],
  },
  {
    request: "Review the PR before I merge it.",
    skill: "review",
    does: "It reports only the findings it can back with evidence and changes nothing. If the tests changed a lot, it also calls test-audit.",
    reads: [
      {
        file: "delegation-and-review.md",
        from: "engineering",
        when: "to tell you whether this review counts as independent, which needs a reviewer that did not write the change",
      },
    ],
  },
  {
    request: "Rewrite the PR description so API users can follow it.",
    skill: "technical-writing",
    does: "It rewrites the description from the branch and its checks.",
    reads: [
      { file: "pull-requests.md", when: "the format for a PR description" },
      { file: "technical-prose.md", when: "the writing rules for any technical text" },
    ],
  },
];
// A renamed or moved reference fails the build instead of the example going stale.
for (const { skill, reads } of turns)
  for (const { file, from = skill } of reads)
    if (!skillNamed(from).references.includes(file))
      throw new Error(`${from} has no reference named ${file}`);
const commands = {
  claude:
    "claude plugin marketplace add filipgutica/filip-stack\nclaude plugin install workflow@filip-stack",
  codex:
    "codex plugin marketplace add filipgutica/filip-stack\ncodex plugin add workflow@filip-stack",
  standalone:
    "npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y",
};
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <h1 id="title">Skills and setup for Claude and Codex.</h1>
    <p class="lede">
      Choose what to install for your coding agent. Start with Workflow for
      planning, changes, review, and writing; these commands install it.
    </p>
    <div class="cmd-pair">
      <div id="install">
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
    <dl class="fg-site-facts">
      <div>
        <dt>Hosts</dt>
        <dd>Claude Code and Codex</dd>
      </div>
      <div>
        <dt>Skills</dt>
        <dd>
          {{ catalog.workflow.length }} Workflow,
          {{ catalog.standalone.length }} standalone
        </dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>
          <a href="https://github.com/filipgutica/filip-stack"
            >filipgutica/filip-stack</a
          >
        </dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="parts">
    <h2 id="parts">Choose your setup</h2>
    <ul class="parts">
      <li>
        <a href="#workflow">Workflow</a>
        <p>Install it to get all {{ catalog.workflow.length }} Workflow skills.</p>
      </li>
      <li>
        <a href="#standalone">Standalone skills</a>
        <p>
          Choose individual tools for PRs, Jira, Vue, and UX. They install
          separately from Workflow.
        </p>
      </li>
      <li>
        <a href="#field-guide">Field Guide</a>
        <p>
          Add this optional plugin to keep preferences and lessons across sessions.
        </p>
      </li>
      <li>
        <a href="/filip-stack/cli/">filip-stack CLI</a>
        <p>
          Run it to apply shared guidance, agent profiles,
          output styles, and the design language on each machine.
        </p>
      </li>
      <li>
        <a href="/filip-stack/design-language/">Design language</a>
        <p>
          Shared visual rules for pages, mockups, and explainers. The CLI
          installs them to <code>~/design-language</code>.
        </p>
      </li>
    </ul>
  </section>

  <section id="workflow" aria-labelledby="workflow-title">
    <h2 id="workflow-title">How Workflow works</h2>
    <div class="prose">
      <p>
        Workflow is {{ catalog.workflow.length }} skills that install together.
        You describe a task in Claude or Codex in your own words, without
        naming a skill, though you can. For each request, the host compares it with each
        skill's name and description and picks the skill that fits.
      </p>
      <p>
        The picked skill reads its own <code>SKILL.md</code>. It reads a
        longer guide from a <code>references</code> folder only when the task
        needs it.
      </p>
    </div>
    <h3 id="workflow-example" class="workflow-heading">
      Example: one feature, four requests
    </h3>
    <ol class="flow" aria-labelledby="workflow-example">
      <li v-for="turn in turns" :key="turn.request">
        <div class="flow__ask">
          <p class="flow__label">You type</p>
          <p>“{{ turn.request }}”</p>
        </div>
        <div class="flow__skill">
          <p class="flow__label">The host picks</p>
          <p>
            <a :href="`/filip-stack/skills/${turn.skill}/`"
              ><code>{{ turn.skill }}</code></a
            >. {{ turn.does }}
          </p>
          <p class="flow__label">Extra guides it reads</p>
          <ul class="flow__reads">
            <li v-for="read in turn.reads" :key="read.file">
              <code>{{ read.file }}</code
              ><span v-if="read.from"> from {{ read.from }}</span>:
              {{ read.when }}
            </li>
          </ul>
        </div>
      </li>
    </ol>
    <h3 class="workflow-heading">The {{ catalog.workflow.length }} Workflow skills</h3>
    <SkillList :skills="catalog.workflow" :trait="false" />
    <p class="hint">
      Some standalone skills fit before or after this flow:
      <a href="/filip-stack/skills/grill-me/"><code>grill-me</code></a>
      stress-tests a plan before the spec, and
      <a href="/filip-stack/skills/sol-loop/"><code>sol-loop</code></a> and
      <a href="/filip-stack/skills/merge-council/"><code>merge-council</code></a>
      run final reviews before merge. They install separately and run only
      when asked: by you, or for <code>merge-council</code>, also by your
      repository's guidance. See <a href="#standalone">Standalone skills</a>.
    </p>
  </section>

  <section id="standalone" aria-labelledby="standalone-title">
    <h2 id="standalone-title">Standalone skills</h2>
    <p class="section-intro">
      Replace <code>&lt;name&gt;</code> with a skill below. Run the same command
      again to update it.
    </p>
    <UiCodeBlock
      :code="commands.standalone"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
    <SkillList :skills="catalog.standalone" />
  </section>

  <section id="field-guide" aria-labelledby="fg-title">
    <h2 id="fg-title">Field Guide</h2>
    <div class="prose">
      <p>
        Field Guide stores preferences, corrections, and recurring lessons under
        <code>~/.field-guide</code>. Its hooks add repository guidance at session
        start and matching records on your first prompt. Current instructions
        and live code take priority.
      </p>
      <p>
        Install <code>field-guide@filip-stack</code> through the same marketplace.
        Workflow does not depend on it.
        <a href="/filip-stack/field-guide/">How Field Guide works</a>.
      </p>
    </div>
  </section>

  <section aria-labelledby="guides">
    <h2 id="guides">Guides</h2>
    <ul class="parts">
      <li>
        <a href="/filip-stack/agent-ready-environments/"
          >Agent-ready environments</a
        >
        <p>
          A lesson on setting up repositories so coding agents can check their
          own work, with a worked audit of this repository.
        </p>
      </li>
    </ul>
  </section>
</template>
