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
    does: "It writes the spec from the repository without editing code. A separate reviewer critiques this public API spec first.",
    reads: [
      { file: "spec.md", when: "spec format" },
      {
        file: "technical-prose.md",
        from: "technical-writing",
        when: "writing rules",
      },
    ],
  },
  {
    request: "Implement the spec and open a PR.",
    skill: "engineering",
    does: "It makes the smallest change that meets the spec and reruns affected checks. A separate reviewer checks it first, or the agent says none was available.",
    reads: [
      {
        file: "testing-and-debugging.md",
        when: "if reproducing or testing is unclear",
      },
      {
        file: "delegation-and-review.md",
        when: "for a separate reviewer",
      },
      {
        file: "commit-and-pr-hygiene.md",
        when: "before committing or opening the PR",
      },
    ],
  },
  {
    request: "Review the PR before I merge it.",
    skill: "review",
    does: "It changes no files and reports only evidence-backed findings. It also runs test-audit if tests changed heavily.",
    reads: [
      {
        file: "delegation-and-review.md",
        from: "engineering",
        when: "to report whether the review was independent",
      },
    ],
  },
  {
    request: "Rewrite the PR description so API users can follow it.",
    skill: "technical-writing",
    does: "It rewrites the description from the branch and checks.",
    reads: [
      { file: "pull-requests.md", when: "PR description format" },
      { file: "technical-prose.md", when: "writing rules" },
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
      Reusable skills and optional setup for Claude Code and Codex. A skill
      gives your agent task instructions, such as reviewing a branch or writing
      a plan. Start with Workflow. Everything else is optional.
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
          <p>Add the plugin marketplace and install Workflow.</p>
          <HostCommands
            :claude="commands.claude"
            :codex="commands.codex"
            claude-id="install"
          />
        </div>
      </li>
      <li>
        <div>
          <p>In Codex, restart to load the plugin.</p>
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
            The agent picks
            <a href="/filip-stack/skills/review/"><code>review</code></a> on its
            own. It reads every changed file without editing anything, then
            lists evidence-backed findings ranked by impact with file and line
            numbers, or reports none.
          </p>
        </div>
      </li>
    </ol>
  </section>

  <section id="workflow" aria-labelledby="workflow-title">
    <h2 id="workflow-title">How Workflow works</h2>
    <div class="prose">
      <p>
        Workflow installs {{ catalog.workflow.length }} engineering skills in
        one plugin with no hooks. Describe your task, and Claude Code or Codex
        picks the matching skill, or name one yourself. Extra guides load only
        when needed.
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
          <p class="flow__label">Skill picked</p>
          <p>
            <a :href="`/filip-stack/skills/${turn.skill}/`"
              ><code>{{ turn.skill }}</code></a
            >. {{ turn.does }}
          </p>
          <p class="flow__label">Guides it reads</p>
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
      Use <a href="/filip-stack/skills/grill-me/"><code>grill-me</code></a> to
      question an idea before writing a spec. Use
      <a href="/filip-stack/skills/sol-loop/"><code>sol-loop</code></a> to
      review code in rounds, or
      <a href="/filip-stack/skills/full-stop/"><code>full-stop</code></a> to
      take a change through review and CI with an optional council threshold
      (minimum multi-model score). These standalone skills run only when you
      ask.
    </p>
  </section>

  <section id="standalone" aria-labelledby="standalone-title">
    <h2 id="standalone-title">Standalone skills</h2>
    <p class="section-intro">
      Install only the standalone skills you need, along with any dependencies
      listed for your chosen skill. Replace <code>&lt;name&gt;</code> with a
      skill below, and rerun to update.
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
          Apply shared global guidance, profiles, and output styles, and sync
          skills across machines.
        </p>
      </li>
      <li>
        <a href="/filip-stack/design-system/">Design system</a>
        <p>
          A separate plugin with the visual rules agents follow for UI and
          visual work.
        </p>
      </li>
      <li>
        <a href="/filip-stack/field-guide/">Field Guide</a>
        <p>
          An optional plugin that remembers your preferences and corrections
          across sessions.
        </p>
      </li>
      <li>
        <a href="https://github.com/filipgutica/filip-stack#guardrails">Guardrails</a>
        <p>
          An optional plugin that checks your agent's shell commands. It blocks
          AI co-author trailers and "Generated with" footers in commits, PRs,
          and issues, and asks you before a 1Password (<code>op</code>) command
          runs. In Codex, that prompt also needs Host config.
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
          Set up a repository so agents can verify their own work, with a worked
          audit.
        </p>
      </li>
    </ul>
  </section>
</template>
