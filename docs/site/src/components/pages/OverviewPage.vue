<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  UiBadge,
  UiButton,
  UiCard,
  UiCodeBlock,
  UiSegmentedControl,
} from "@filipgutica/ui";
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
  { label: "Change", names: ["engineering", "simplify-pass"] },
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
// Each example is one request per turn: the host picks a skill again for every
// request. A named reference must exist in its skill, so a renamed file fails the build.
type Turn = {
  request: string;
  skill: string;
  note: string;
  /** The engineering step to show; turns for other skills keep the current one. */
  step?: number;
  /** Undefined when the reference depends on what the request asks for. */
  references?: string[];
};
const examples: { value: string; label: string; turns: Turn[] }[] = [
  {
    value: "feature",
    label: "Feature",
    turns: [
      {
        request: "Spec rate limiting for the public API.",
        skill: "planning",
        note: "You start without code. planning writes the spec from repository evidence.",
      },
      {
        request: "Implement the rate-limiting spec.",
        skill: "engineering",
        step: 1,
        references: ["testing-and-debugging.md", "delegation-and-review.md"],
        note: "A new request, so the host picks again. engineering runs its loop until the checks pass.",
      },
      {
        request: "Review the branch.",
        skill: "review",
        references: [],
        note: "review checks the exact change and reports only the findings it can back with evidence.",
      },
      {
        request: "Write the PR description.",
        skill: "technical-writing",
        references: ["pull-requests.md"],
        note: "technical-writing loads its pull request reference and nothing else.",
      },
      {
        request: "Run a sol loop on the PR.",
        skill: "sol-loop",
        references: [],
        note: "sol-loop is a standalone skill. Install it on its own.",
      },
    ],
  },
  {
    value: "bug",
    label: "Bug fix",
    turns: [
      {
        request: "Fix the failing test.",
        skill: "engineering",
        step: 1,
        references: ["testing-and-debugging.md"],
        note: "One request, one skill. engineering reproduces the failure before it changes code.",
      },
    ],
  },
  {
    value: "review",
    label: "Review",
    turns: [
      {
        request: "Review this diff.",
        skill: "review",
        references: [],
        note: "One request, one skill. review loads no reference.",
      },
    ],
  },
];
for (const { turns } of examples)
  for (const { skill, references = [] } of turns)
    for (const reference of references)
      if (!skillNamed(skill).references.includes(reference))
        throw new Error(`${skill} has no reference named ${reference}`);
const exampleItems = examples.map(({ value, label }) => ({ value, label }));
// The ring places the engineering steps clockwise from the top, 60 degrees apart.
// The SVG draws only the arcs; each step is HTML placed over it by percentage.
const ring = { x: 160, y: 110, radius: 70 };
const viewBox = { x: -24, width: 368, height: 222 };
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
      "Before editing, decide what must stay the same and which checks prove it. Stop if no change is needed.",
  },
  {
    name: "Reproduce or test",
    detail:
      "Run the nearest fitting test, if any, and record its result. A new regression test must fail before the fix.",
  },
  {
    name: "Smallest change",
    detail:
      "Fix the code that owns the behavior. Avoid speculative options, abstractions, dependencies, and nearby cleanup.",
  },
  {
    name: "Focused checks",
    detail:
      "Rerun the same test and only affected checks. Broaden only when the change or a failure calls for it.",
  },
  {
    name: "Read the diff",
    detail:
      "Check for accidental changes, duplication, dead code, and needless indirection. Rerun checks after any edit.",
  },
  {
    name: "Review decisions",
    detail:
      "Get an independent review for consequential or hard-to-reverse changes before calling the work done. If no separate reviewer is available, inspect the diff with care and report that independent review did not run.",
  },
].map((step, index) => {
  const { x, y } = pointAt(index * 60);
  return {
    ...step,
    // The side the label sits on, away from the ring's centre.
    side: ["top", "right", "right", "bottom", "left", "left"][index],
    position: {
      left: `${((x - viewBox.x) / viewBox.width) * 100}%`,
      top: `${(y / viewBox.height) * 100}%`,
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
const exampleValue = ref<string | undefined>("feature");
const turnIndex = ref(0);
const selectedSkill = ref("planning");
const selectedStep = ref(0);
const selected = computed(() => skillNamed(selectedSkill.value));
const example = computed(() =>
  examples.find(({ value }) => value === exampleValue.value),
);
const turn = computed(() => example.value?.turns[turnIndex.value]);
const turnLabel = computed(() => {
  if (!example.value) return "No example selected";
  const { length } = example.value.turns;
  return length > 1 ? `Turn ${turnIndex.value + 1} of ${length}` : "One request";
});
const references = computed(() => turn.value?.references);
const showTurn = (index: number) => {
  const next = example.value?.turns[index];
  if (!next) return;
  turnIndex.value = index;
  selectedSkill.value = next.skill;
  if (next.step !== undefined) selectedStep.value = next.step;
};
const pickExample = (value: string) => {
  exampleValue.value = value;
  showTurn(0);
};
// Picking a skill directly leaves the example, so no turn claims it.
const pickSkill = (name: string) => {
  exampleValue.value = undefined;
  selectedSkill.value = name;
};
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

  <section id="workflow" aria-labelledby="workflow-title">
    <h2 id="workflow-title">How Workflow works</h2>
    <p class="section-intro">
      Describe your task in Claude or Codex. The host selects a matching skill,
      which loads only the guidance that task needs.
    </p>
    <UiCard class="workflow-map" :class="{ 'is-enhanced': enhanced }">
      <div v-if="enhanced" class="map-region map-examples">
        <UiSegmentedControl
          label="Example request"
          :items="exampleItems"
          :model-value="exampleValue"
          @update:model-value="pickExample"
        />
        <div class="map-turn" aria-live="polite">
          <span class="map-label">{{ turnLabel }}</span>
          <p v-if="turn" class="map-turn__request">“{{ turn.request }}”</p>
          <p class="map-turn__note">
            {{
              turn?.note ??
              "Pick an example above to follow a request through the stages."
            }}
          </p>
        </div>
        <div v-if="example && example.turns.length > 1" class="map-turn-nav">
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="turnIndex === 0"
            @click="showTurn(turnIndex - 1)"
            >Back</UiButton
          >
          <UiButton
            variant="secondary"
            size="sm"
            :disabled="turnIndex === example.turns.length - 1"
            @click="showTurn(turnIndex + 1)"
            >Next turn</UiButton
          >
        </div>
      </div>
      <div class="map-region">
        <p id="map-stages-label" class="map-label">
          Skills by stage{{ enhanced ? ". Pick one to see what it does." : "" }}
        </p>
        <ol
          class="map-stages"
          :role="enhanced ? 'radiogroup' : undefined"
          aria-labelledby="map-stages-label"
        >
          <li
            v-for="(stage, index) in stages"
            :key="stage.label"
            :class="{
              'is-current':
                enhanced &&
                stage.skills.some(({ name }) => name === selectedSkill),
            }"
          >
            <span class="map-stage-mark" aria-hidden="true">{{
              index + 1
            }}</span>
            <h3>
              {{ stage.label }}<small v-if="stage.standalone">Standalone</small>
            </h3>
            <ul>
              <li v-for="skill in stage.skills" :key="skill.name">
                <label v-if="enhanced" class="map-skill">
                  <input
                    type="radio"
                    name="map-skill"
                    :value="skill.name"
                    :checked="selectedSkill === skill.name"
                    @change="pickSkill(skill.name)"
                  />
                  <code>{{ skill.name }}</code>
                  <UiBadge v-if="skill.manual">Manual</UiBadge>
                </label>
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
      </div>
      <div
        v-if="enhanced"
        class="map-region map-skill-detail"
        aria-live="polite"
      >
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
          Call it with <code>/{{ selected.group === "Workflow" ? "workflow:" : "" }}{{ selected.name }}</code>
          in Claude or
          <code>${{ selected.group === "Workflow" ? "workflow:" : "" }}{{ selected.name }}</code>
          in Codex.
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
          <div
            class="map-ring"
            :role="enhanced ? 'group' : undefined"
            :aria-label="
              enhanced
                ? 'engineering repeats six steps. A failed check returns work to the step it affects.'
                : undefined
            "
            :aria-hidden="enhanced ? undefined : 'true'"
          >
            <svg viewBox="-24 0 368 222" aria-hidden="true">
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
            </svg>
            <p class="map-ring__center">
              <strong>engineering</strong><span>until checks pass</span>
            </p>
            <span class="map-ring__fails" aria-hidden="true">fails</span>
            <component
              :is="enhanced ? 'button' : 'span'"
              v-for="(step, index) in steps"
              :key="step.name"
              class="map-ring-step"
              :type="enhanced ? 'button' : undefined"
              :data-side="step.side"
              :style="step.position"
              :aria-pressed="enhanced ? selectedStep === index : undefined"
              :aria-label="
                enhanced ? `Step ${index + 1}: ${step.name}` : undefined
              "
              @click="selectedStep = index"
            >
              <span class="map-step-number">{{ index + 1 }}</span>
              <span class="map-ring-step__label">{{ step.name }}</span>
            </component>
          </div>
          <!-- Without JavaScript, and on phones where the ring has no room, the steps are a list. -->
          <ol class="map-steps">
            <li v-for="(step, index) in steps" :key="step.name">
              <button
                v-if="enhanced"
                type="button"
                :aria-pressed="selectedStep === index"
                :aria-label="`Step ${index + 1}: ${step.name}`"
                @click="selectedStep = index"
              >
                <span class="map-step-number">{{ index + 1 }}</span
                >{{ step.name }}
              </button>
              <template v-else>
                <strong>{{ step.name }}</strong>
                <span>{{ step.detail }}</span>
              </template>
            </li>
          </ol>
          <p v-if="enhanced" class="map-step-detail" aria-live="polite">
            <strong
              >{{ selectedStep + 1 }}. {{ steps[selectedStep]!.name }}</strong
            >
            <span>{{ steps[selectedStep]!.detail }}</span>
          </p>
          <p class="map-muted">
            A failed check sends work back only to the step it affects. Stop
            conditions end repeated retries.
          </p>
        </div>
        <div>
          <h3 class="map-label">What the host loads</h3>
          <ol class="map-load">
            <li>
              <strong>Skill names and descriptions</strong>
              <span
                >Always loaded, except for manual skills. The host uses these
                to choose.</span
              >
              <ol>
                <li>
                  <code>{{ selectedSkill }}/SKILL.md</code>
                  <span>The rules for the selected skill.</span>
                  <ol>
                    <li v-for="reference in references" :key="reference">
                      <code>references/{{ reference }}</code>
                      <span>Loads only when the task needs it.</span>
                    </li>
                    <li v-if="!references?.length" class="map-load__none">
                      {{
                        references ? "No reference loaded" : "Depends on the request"
                      }}
                    </li>
                  </ol>
                </li>
              </ol>
            </li>
          </ol>
        </div>
      </div>
    </UiCard>
    <p class="hint">
      Skills marked manual run only when you call them:
      <code>/simplify-pass</code> in Claude,
      <code>$simplify-pass</code> in Codex. The others are picked when a
      request matches.
    </p>
  </section>
</template>
