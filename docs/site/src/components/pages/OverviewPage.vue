<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { UiCodeBlock, UiCard, UiBadge } from "@filipgutica/ui";
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
  if (!skill) throw new Error(`The Workflow map names an unknown skill: ${name}`);
  return skill;
};
const stages = [
  { label: "Before code", names: ["planning", "grill-me"] },
  { label: "Change", names: ["engineering", "simplify"] },
  { label: "Check", names: ["review", "test-audit", "walkthrough"] },
  { label: "Write it up", names: ["technical-writing", "checkpoint"] },
  { label: "Before merge", names: ["sol-loop", "merge-council"] },
].map(({ label, names }) => {
  const skills = names.map(skillNamed);
  return {
    label,
    skills,
    standalone: skills.every(({ group }) => group === "Standalone"),
  };
});
// A named reference must exist in that skill, so a renamed file fails the build.
const requests = [
  { text: "Compare options for the auth refactor", skill: "planning" },
  {
    text: "Fix the failing test",
    skill: "engineering",
    reference: "testing-and-debugging.md",
  },
  { text: "Review this diff", skill: "review" },
  {
    text: "Edit the README section",
    skill: "technical-writing",
    reference: "technical-prose.md",
  },
  { text: "Run a sol loop on this change", skill: "sol-loop" },
].map((request) => {
  if (
    request.reference &&
    !skillNamed(request.skill).references.includes(request.reference)
  )
    throw new Error(
      `${request.skill} has no reference named ${request.reference}`,
    );
  return request;
});
// The ring places the engineering steps clockwise from the top, 60 degrees apart.
const ring = { x: 160, y: 110, radius: 70 };
const pointAt = (degrees: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: ring.x + ring.radius * Math.cos(radians),
    y: ring.y + ring.radius * Math.sin(radians),
  };
};
const steps = [
  {
    name: "Define the boundary",
    detail:
      "Decide which behavior must not change and which checks prove it, before editing. If no change is needed, stop.",
  },
  {
    name: "Reproduce or test",
    detail:
      "Run the nearest existing test for the request and record the result. A new regression test must fail before the fix.",
  },
  {
    name: "Smallest change",
    detail:
      "Fix the code that owns the behavior. No speculative options, abstractions, dependencies, or nearby cleanup.",
  },
  {
    name: "Focused checks",
    detail:
      "Rerun the same test and only the affected checks. Broaden only when the change or a failure calls for it.",
  },
  {
    name: "Read the diff",
    detail:
      "Look for accidental changes, duplication, dead code, and needless indirection. Rerun checks after any edit.",
  },
  {
    name: "Review decisions",
    detail:
      "Send consequential or hard-to-reverse changes to an independent review before calling the work done.",
  },
].map((step, index) => {
  const { x, y } = pointAt(index * 60);
  const side = [0, 3].includes(index) ? 0 : index < 3 ? 1 : -1;
  return {
    ...step,
    x,
    y,
    label: {
      x: x + side * 17.4,
      y: side ? y + 4 : index === 0 ? y - 20 : y + 27,
      anchor: ["end", "middle", "start"][side + 1],
    },
  };
});
const arcs = steps.map((_, index) => {
  const from = pointAt(index * 60 + 13);
  const to = pointAt(index * 60 + 47);
  return `M${from.x} ${from.y}A${ring.radius} ${ring.radius} 0 0 1 ${to.x} ${to.y}`;
});
const commands = {
  claude:
    "claude plugin marketplace add filipgutica/filip-stack\nclaude plugin install workflow@filip-stack",
  codex:
    "codex plugin marketplace add filipgutica/filip-stack\ncodex plugin add workflow@filip-stack",
  standalone:
    "npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y",
};
const enhanced = ref(false);
const selectedRequest = ref<number | undefined>(1);
const selectedSkill = ref("engineering");
const selectedStep = ref(2);
const selected = computed(() => skillNamed(selectedSkill.value));
const loadedReference = computed(() =>
  selectedRequest.value === undefined
    ? "Depends on the request"
    : (requests[selectedRequest.value]!.reference ?? "No reference loaded"),
);
const pickRequest = (index: number) => {
  selectedRequest.value = index;
  selectedSkill.value = requests[index]!.skill;
};
const pickSkill = (name: string) => {
  selectedRequest.value = undefined;
  selectedSkill.value = name;
};
// Hover and focus areas pad each step's measured number and label. The ring is
// hidden on narrow maps, so measure again once it can be seen.
const stepNodes: SVGGElement[] = [];
const hitBoxes = ref<{ x: number; y: number; width: number; height: number }[]>(
  [],
);
const measureSteps = () => {
  if (hitBoxes.value.some(({ width }) => width > 14)) return;
  hitBoxes.value = stepNodes.map((node) => {
    const box = node.getBBox();
    return {
      x: box.x - 7,
      y: box.y - 6,
      width: box.width + 14,
      height: box.height + 12,
    };
  });
};
onMounted(() => {
  enhanced.value = true;
  measureSteps();
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
      You describe the task, and the host routes it to the skill for that
      stage. Each skill loads only the guidance the task needs.
    </p>
    <UiCard class="workflow-map" :class="{ 'is-enhanced': enhanced }">
      <div v-if="enhanced" class="map-requests">
        <p id="map-requests-label" class="map-label">
          Try a request, or click any skill or step
        </p>
        <div role="group" aria-labelledby="map-requests-label">
          <button
            v-for="(request, index) in requests"
            :key="request.text"
            type="button"
            :aria-pressed="selectedRequest === index"
            @click="pickRequest(index)"
          >
            {{ request.text }}
          </button>
        </div>
      </div>
      <ol class="map-stages" aria-label="Skills by stage">
        <li
          v-for="stage in stages"
          :key="stage.label"
          :class="{
            'is-current':
              enhanced &&
              stage.skills.some(({ name }) => name === selectedSkill),
            'is-standalone': stage.standalone,
          }"
        >
          <h3>
            {{ stage.label }}<small v-if="stage.standalone">Standalone</small>
          </h3>
          <ul>
            <li v-for="skill in stage.skills" :key="skill.name">
              <button
                v-if="enhanced"
                type="button"
                class="map-skill"
                :aria-pressed="selectedSkill === skill.name"
                @click="pickSkill(skill.name)"
              >
                <code>{{ skill.name }}</code>
                <UiBadge v-if="skill.manual">Manual</UiBadge>
              </button>
              <a
                v-else
                class="map-skill"
                :href="`/filip-stack/skills/${skill.name}/`"
              >
                <code>{{ skill.name }}</code>
                <UiBadge v-if="skill.manual">Manual</UiBadge>
              </a>
            </li>
          </ul>
        </li>
      </ol>
      <div v-if="enhanced" class="map-skill-detail" aria-live="polite">
        <h3>
          <code>{{ selected.name }}</code>
          <UiBadge>{{ selected.group }}</UiBadge>
          <UiBadge>{{
            selected.manual ? "Manual" : "Picked by request"
          }}</UiBadge>
        </h3>
        <a :href="`/filip-stack/skills/${selected.name}/`">Open skill page</a>
        <p v-html="selected.summaryHtml" />
        <p v-if="selected.manual" class="map-muted">
          Call it with <code>/workflow:{{ selected.name }}</code> in Claude or
          <code>$workflow:{{ selected.name }}</code> in Codex.
        </p>
        <p v-else-if="selected.group === 'Standalone'" class="map-muted">
          Not part of the Workflow plugin. Install it on its own; the host picks
          it when a request matches.
        </p>
        <p v-else class="map-muted">
          The host picks it when a request matches.
        </p>
      </div>
      <div class="map-panels">
        <div>
          <h3 class="map-label">The loop inside <code>engineering</code></h3>
          <svg
            class="map-ring"
            viewBox="-24 0 368 222"
            :role="enhanced ? 'group' : 'img'"
            aria-label="engineering repeats six steps. A failed check returns work to the step it affects."
            @pointerenter="measureSteps"
            @focusin="measureSteps"
          >
            <defs>
              <marker
                id="map-ring-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path class="map-ring__arrow" d="M0 0L10 5L0 10z" />
              </marker>
              <marker
                id="map-ring-retry"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path class="map-ring__retry-arrow" d="M0 0L10 5L0 10z" />
              </marker>
            </defs>
            <path
              v-for="arc in arcs"
              :key="arc"
              class="map-ring__arc"
              :d="arc"
              marker-end="url(#map-ring-arrow)"
            />
            <!-- From step 4 back to step 3: a failed check retries the change. -->
            <path
              class="map-ring__retry"
              d="M152 166Q170 134 206 142"
              marker-end="url(#map-ring-retry)"
            />
            <text class="map-ring__retry-label" x="150" y="146">fails</text>
            <g
              v-for="(step, index) in steps"
              :key="step.name"
              :ref="
                (node) => {
                  if (node) stepNodes[index] = node as SVGGElement;
                }
              "
              class="map-ring__step"
              :class="{ 'is-current': enhanced && selectedStep === index }"
              :role="enhanced ? 'button' : undefined"
              :tabindex="enhanced ? 0 : undefined"
              :aria-pressed="enhanced ? selectedStep === index : undefined"
              :aria-label="
                enhanced ? `Step ${index + 1}: ${step.name}` : undefined
              "
              @click="selectedStep = index"
              @keydown.enter.prevent="selectedStep = index"
              @keydown.space.prevent="selectedStep = index"
            >
              <rect
                v-if="hitBoxes[index]"
                class="map-ring__hit"
                v-bind="hitBoxes[index]"
                rx="9"
              />
              <circle :cx="step.x" :cy="step.y" r="12" />
              <text class="map-ring__number" :x="step.x" :y="step.y + 4">
                {{ index + 1 }}
              </text>
              <text
                class="map-ring__label"
                :x="step.label.x"
                :y="step.label.y"
                :text-anchor="step.label.anchor"
              >
                {{ step.name }}
              </text>
            </g>
            <text class="map-ring__name" x="160" y="106">engineering</text>
            <text class="map-ring__sub" x="160" y="120">until checks pass</text>
          </svg>
          <p v-if="enhanced" class="map-step-detail" aria-live="polite">
            <strong
              >{{ selectedStep + 1 }}. {{ steps[selectedStep]!.name }}</strong
            >
            <span>{{ steps[selectedStep]!.detail }}</span>
          </p>
          <ol class="map-steps">
            <li v-for="step in steps" :key="step.name">
              <strong>{{ step.name }}</strong>
              <span>{{ step.detail }}</span>
            </li>
          </ol>
          <p class="map-muted">
            A failed check sends work back only to the step it affects. Stop
            conditions end repeated retries.
          </p>
        </div>
        <div>
          <h3 class="map-label">What the host loads</h3>
          <div class="map-load">
            <strong>Every skill's name and description</strong>
            <span>Always loaded. This is all the host reads to choose.</span>
            <div class="map-load">
              <strong><code>{{ selectedSkill }}</code> SKILL.md</strong>
              <span>Only the chosen skill's rules.</span>
              <div class="map-load">
                <strong
                  ><code>{{ loadedReference }}</code></strong
                >
                <span>A reference, only when the task's mode needs one.</span>
              </div>
            </div>
          </div>
        </div>
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
