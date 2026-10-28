<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock, UiCard, UiBadge } from "@filipgutica/ui";
import SkillList from "../SkillList.vue";
import type { Catalog } from "../../catalog";
const { catalog } = defineProps<{ catalog: Catalog }>();
const purposes = [
  { label: "Before code", names: ["planning", "grill-me"] },
  { label: "Change", names: ["engineering", "simplify"] },
  { label: "Check", names: ["review", "test-audit", "walkthrough"] },
  { label: "Write it up", names: ["technical-writing", "checkpoint"] },
].map(({ label, names }) => ({
  label,
  skills: catalog.workflow.filter(({ name }) => names.includes(name)),
}));
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
      An engineering workflow, standalone skills, optional local memory, and one
      command that sets up the agent guidance on each machine.
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
    <h2 id="parts">What's included</h2>
    <ul class="parts">
      <li>
        <a href="#workflow">Workflow</a>
        <p>
          A plugin with nine skills for the engineering loop: plan, change,
          check, and write it up.
        </p>
      </li>
      <li>
        <a href="#standalone">Standalone skills</a>
        <p>
          Nine independent skills for PRs, reviews, Jira, Vue, and UX. Install
          the ones you use.
        </p>
      </li>
      <li>
        <a href="/filip-stack/cli/">filip-stack CLI</a>
        <p>
          Applies shared guidance, agent profiles, output styles, and the design
          language to each machine.
        </p>
      </li>
      <li>
        <a href="/filip-stack/design-language/">Design language</a>
        <p>
          The visual rules agents follow for pages, mockups, and explainers,
          installed to <code>~/design-language</code>.
        </p>
      </li>
    </ul>
  </section>

  <section id="workflow" aria-labelledby="workflow-title">
    <h2 id="workflow-title">How Workflow works</h2>
    <p class="section-intro">
      The host picks a skill from your request. Each skill loads only as much
      guidance as the task needs, so the context stays small.
    </p>
    <UiCard class="workflow-map">
      <ol class="levels" aria-label="What the host reads">
        <li>
          <strong>Name and description</strong
          ><span>All the host sees while it chooses a skill.</span>
        </li>
        <li>
          <strong>SKILL.md</strong
          ><span>The selected skill's operating rules.</span>
        </li>
        <li>
          <strong>One reference</strong
          ><span>Opened only when the task's mode needs it.</span>
        </li>
      </ol>
      <div class="purposes">
        <div v-for="group in purposes" :key="group.label">
          <h3>{{ group.label }}</h3>
          <ul>
            <li v-for="skill in group.skills" :key="skill.name">
              <a :href="`/filip-stack/skills/${skill.name}/`"
                >{{ skill.name }}
                <UiBadge v-if="skill.manual">Manual</UiBadge></a
              >
            </li>
          </ul>
        </div>
      </div>
      <div class="loop">
        <ol aria-label="The engineering loop">
          <li>Define the boundary</li>
          <li>Reproduce or test</li>
          <li>Smallest change</li>
          <li>Focused checks</li>
          <li>Read the diff</li>
          <li>Review decisions</li>
        </ol>
        <p>
          When a check fails, work returns only to the step it affects. Stop
          conditions prevent endless retries.
        </p>
      </div>
    </UiCard>
    <p class="hint">
      Skills marked manual run only when you call them:
      <code>/workflow:simplify</code> in Claude,
      <code>$workflow:simplify</code> in Codex. The others are picked when a
      request matches.
    </p>
  </section>

  <section id="standalone" aria-labelledby="standalone-title">
    <h2 id="standalone-title">Standalone skills</h2>
    <p class="section-intro">
      Each one installs on its own. Run the same command again to update it.
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
        An optional plugin that keeps your durable preferences, corrections, and
        lessons under <code>~/.field-guide</code>. At the start of a session, it
        adds the stored guidance that matches the work. Current instructions and
        live code still take priority.
      </p>
      <p>
        Install <code>field-guide@filip-stack</code> the same way as Workflow.
        Workflow does not depend on it.
        <a href="/filip-stack/field-guide/">How Field Guide works</a>.
      </p>
    </div>
  </section>
</template>
