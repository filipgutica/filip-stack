<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock } from "@filipgutica/ui";
import SkillList from "../SkillList.vue";
import HostCommands from "../HostCommands.vue";
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
    does: "It writes the spec from the repository and changes no code. A public API is a public contract, so a separate reviewer critiques the spec first.",
    reads: [
      { file: "spec.md", when: "the format for a specification" },
      {
        file: "technical-prose.md",
        from: "technical-writing",
        when: "writing rules for the spec",
      },
    ],
  },
  {
    request: "Implement the spec and open a PR.",
    skill: "engineering",
    does: "It makes the smallest change that meets the spec and reruns the affected checks. A separate reviewer checks this risky change first, or the agent says none was available.",
    reads: [
      {
        file: "testing-and-debugging.md",
        when: "only if reproducing or testing the change is unclear",
      },
      {
        file: "delegation-and-review.md",
        when: "because the change needs a separate reviewer",
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
    does: "It reports only findings it can back with evidence and changes nothing. If tests changed a lot, it also calls test-audit.",
    reads: [
      {
        file: "delegation-and-review.md",
        from: "engineering",
        when: "to say whether the review is independent of the change's author",
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
      A skill is a set of reusable instructions that a coding agent loads when
      a task needs it, such as reviewing a change or writing a plan. Start
      with Workflow. The rest is optional.
    </p>
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

  <section aria-labelledby="first-skill">
    <h2 id="first-skill">Try your first skill</h2>
    <ol class="fg-site-steps">
      <li>
        <div>
          <p>Install the Workflow plugin.</p>
          <HostCommands
            :claude="commands.claude"
            :codex="commands.codex"
            claude-id="install"
          />
        </div>
      </li>
      <li>
        <div>
          <p>In Codex, restart so a new session loads the plugin.</p>
        </div>
      </li>
      <li>
        <div>
          <p>
            In a repository with changes on a branch, ask:
            “Review the changes on this branch against main.”
          </p>
        </div>
      </li>
      <li>
        <div>
          <p>
            The agent picks the
            <a href="/filip-stack/skills/review/"><code>review</code></a> skill
            on its own. It reads every changed file, changes none, and lists
            findings ranked by impact with a file and line each, or says it
            found none it can back with evidence.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section id="workflow" aria-labelledby="workflow-title">
    <h2 id="workflow-title">How Workflow works</h2>
    <div class="prose">
      <p>
        Workflow's {{ catalog.workflow.length }} skills install together as one
        plugin. Describe a task, and the host picks the skill whose
        description fits, or name one yourself. Each skill reads a
        longer guide only when the task needs it.
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
      <a href="/filip-stack/skills/grill-me/"><code>grill-me</code></a>
      tests a plan before the spec.
      <a href="/filip-stack/skills/sol-loop/"><code>sol-loop</code></a> and
      <a href="/filip-stack/skills/merge-council/"><code>merge-council</code></a>
      give a final review before merge. These standalone skills run only
      when you ask, or, for
      <code>merge-council</code>, when your repository's guidance asks.
    </p>
  </section>

  <section id="standalone" aria-labelledby="standalone-title">
    <h2 id="standalone-title">Standalone skills</h2>
    <p class="section-intro">
      Install the ones you want, replacing <code>&lt;name&gt;</code> with a
      skill below. Run the command again to update.
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

  <section aria-labelledby="setup">
    <h2 id="setup">Optional setup</h2>
    <ul class="parts">
      <li>
        <a href="/filip-stack/cli/">filip-stack CLI</a>
        <p>
          The same global guidance, agent profiles, and design system on every
          machine.
        </p>
      </li>
      <li>
        <a href="/filip-stack/design-system/">Design system</a>
        <p>
          The visual rules agents follow for pages, mockups, and explainers.
        </p>
      </li>
      <li>
        <a href="/filip-stack/field-guide/">Field Guide</a>
        <p>
          A plugin that remembers your preferences and corrections across
          sessions.
        </p>
      </li>
    </ul>
  </section>

  <section aria-labelledby="guides">
    <h2 id="guides">Guides</h2>
    <ul class="parts">
      <li>
        <a href="/filip-stack/agent-ready-environments/"
          >Agent-ready environments</a
        >
        <p>
          Set up a repository so agents can check their own work, with a
          worked audit.
        </p>
      </li>
    </ul>
  </section>
</template>
