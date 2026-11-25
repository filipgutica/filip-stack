<script setup lang="ts">
import { lessonPillars } from "./pillars";

// Figure 1 answers "when does each piece run": the path one code change takes,
// from the agent's first step to merge. Setup comes before the path, and
// maintenance runs on its own schedule, so both sit outside the numbered list.
const setup = {
  label: "Before any change",
  text: "You, or an agent you ask, set up what the path relies on: one command that installs and starts the app with sample data, the check command, tests, deny rules, and the instruction files.",
  pillars: [6, 2, 3, 7, 4, 1],
};
const path = [
  { stage: "The agent starts", who: "The host", what: "Loads the instruction files it is set up to read, such as AGENTS.md, and skill descriptions.", pillars: [4] },
  { stage: "It edits and runs commands", who: "Sandbox, deny rules, hooks", what: "Allow or block each command and file access.", pillars: [7] },
  { stage: "It checks its work", who: "The agent", what: "Runs the check command and tests. When the change affects the running app, starts it with sample data and looks.", pillars: [2, 3, 6] },
  { stage: "It says it is done", who: "A Stop hook, if set up", what: "Runs the check command again. A failure sends the agent back to work.", pillars: [2, 3] },
  { stage: "A pull request opens", who: "Required CI and reviewers", what: "CI reruns the checks. A reviewer checks the diff against its spec, plus any review angle the diff triggers.", pillars: [2, 3, 5] },
  { stage: "Merge", who: "Repository rules and a person", what: "The rules block the merge until checks pass and a person approves the latest changes, or has authorized the merge in advance within enforced limits.", pillars: [7] },
];
const schedule = {
  label: "On a schedule",
  text: "Whoever maintains the guidance re-audits, and tests whether it still helps after a model release.",
  pillars: [8],
};
const anchor = (number: number) =>
  `#${lessonPillars[number - 1]!.file.replace(/\.md$/, "")}`;
const title = (number: number) => lessonPillars[number - 1]!.title;
</script>

<template>
  <div class="path">
    <p class="path__band">
      <span class="path__label">{{ setup.label }}</span>
      <span>{{ setup.text }}</span>
      <span class="path__pillars">
        <a v-for="number in setup.pillars" :key="number" class="pillar-tag" :href="anchor(number)" :title="title(number)">Pillar {{ number }}</a>
      </span>
    </p>
    <ol class="timeline" aria-label="The path of one change, from first step to merge">
      <li v-for="step in path" :key="step.stage" class="timeline__stage">
        <span class="timeline__when">
          <strong>{{ step.stage }}</strong>
          <span class="timeline__who">{{ step.who }}</span>
        </span>
        <span class="timeline__what">{{ step.what }}</span>
        <span class="path__pillars">
          <a v-for="number in step.pillars" :key="number" class="pillar-tag" :href="anchor(number)" :title="title(number)">Pillar {{ number }}</a>
        </span>
      </li>
    </ol>
    <p class="path__band">
      <span class="path__label">{{ schedule.label }}</span>
      <span>{{ schedule.text }}</span>
      <span class="path__pillars">
        <a v-for="number in schedule.pillars" :key="number" class="pillar-tag" :href="anchor(number)" :title="title(number)">Pillar {{ number }}</a>
      </span>
    </p>
  </div>
</template>

<style scoped>
/* Figure 1: setup above, the numbered path of one change, maintenance below.
   The dashed bands mark what sits outside the path. */
.path { display: grid; gap: var(--space-3); font-size: var(--text-md); }
.path__band { display: grid; grid-template-columns: 13rem minmax(0, 1fr) auto; gap: var(--space-1) var(--space-4); align-items: baseline; max-width: none; margin: 0; padding: var(--space-3); border: 1px dashed var(--color-border); border-radius: var(--radius-panel); color: var(--color-muted); }
.path__label { color: var(--color-text); font-weight: var(--weight-semibold); }
.path__pillars { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); justify-content: end; }
.timeline { display: grid; gap: 0; max-width: none; margin: 0; padding: 0; list-style: none; counter-reset: stage; }
.timeline__stage { position: relative; display: grid; grid-template-columns: 13rem minmax(0, 1fr) auto; gap: var(--space-1) var(--space-4); align-items: baseline; padding: var(--space-3) 0 var(--space-3) var(--space-8); border-top: 1px solid var(--color-border-subtle); counter-increment: stage; }
.timeline__stage:first-child { border-top: 0; }
.timeline__stage::before { content: counter(stage); position: absolute; top: var(--space-3); left: 0; display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border: 1px solid var(--color-border); border-radius: 50%; color: var(--color-muted); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
.timeline__when { display: grid; gap: 2px; }
.timeline__who { color: var(--color-muted); font-size: var(--text-sm); }
.pillar-tag { color: var(--color-muted); font-size: var(--text-xs); }
@media (hover: hover) { .pillar-tag:hover { color: var(--color-text); } }
@media (max-width: 800px) {
  .path__band, .timeline__stage { grid-template-columns: minmax(0, 1fr); gap: var(--space-1); }
  .path__pillars { justify-content: start; }
}
</style>
