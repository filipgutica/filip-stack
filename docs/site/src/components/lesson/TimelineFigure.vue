<script setup lang="ts">
import { lessonPillars } from "./pillars";

// Figure 1 answers "when does each piece run": one code change headed for a
// pull request, from setup to maintenance.
const stages = [
  { when: "Once, ahead of time", who: "You, or an agent you ask", what: "Build the setup command, checks, tests, deny rules, and AGENTS.md.", pillars: [6, 2, 3, 7, 4, 1] },
  { when: "Session start", who: "The host", what: "Loads the instruction files it is set up to read, such as AGENTS.md, and skill descriptions.", pillars: [4] },
  { when: "Every tool call", who: "Sandbox, deny rules, hooks", what: "Allow or block each command and file access.", pillars: [7] },
  { when: "While working", who: "The agent", what: "Runs the check command and tests. When the change affects the running app, starts the seeded app and looks.", pillars: [2, 3, 6] },
  { when: "Before it says done", who: "A Stop hook, if set up", what: "Runs the check command. A failure goes back to the agent.", pillars: [2, 3] },
  { when: "Pull request", who: "Required CI and a reviewer agent", what: "CI reruns the checks. The reviewer checks the diff against its spec, plus any review angle the diff triggers.", pillars: [2, 3, 5] },
  { when: "Merge", who: "A person", what: "Approves, per pull request or in advance with stated limits.", pillars: [7] },
  { when: "On its own schedule", who: "Whoever maintains the guidance", what: "Re-audits, and tests whether the guidance still helps after a model release.", pillars: [8] },
];
const anchor = (number: number) =>
  `#${lessonPillars[number - 1]!.file.replace(/\.md$/, "")}`;
const title = (number: number) => lessonPillars[number - 1]!.title;
</script>

<template>
  <ol class="timeline" aria-label="One task, from setup to merge">
    <li v-for="stage in stages" :key="stage.when" class="timeline__stage">
      <span class="timeline__when">{{ stage.when }}</span>
      <span class="timeline__who">{{ stage.who }}</span>
      <span class="timeline__what">{{ stage.what }}</span>
      <span class="timeline__pillars">
        <a
          v-for="number in stage.pillars"
          :key="number"
          class="pillar-tag"
          :href="anchor(number)"
          :title="title(number)"
          >Pillar {{ number }}</a
        >
      </span>
    </li>
  </ol>
</template>

<style scoped>
/* Figure 1: one task as a vertical timeline. Each stage reads left to right:
   when, who acts, what happens, and the pillars at work. */
.timeline { display: grid; gap: 0; max-width: none; margin: 0; padding: 0; list-style: none; font-size: var(--text-md); counter-reset: stage; }
.timeline__stage { position: relative; display: grid; grid-template-columns: 11rem 13rem minmax(0, 1fr) auto; gap: var(--space-1) var(--space-4); align-items: baseline; padding: var(--space-3) 0 var(--space-3) var(--space-8); border-top: 1px solid var(--color-border-subtle); counter-increment: stage; }
.timeline__stage::before { content: counter(stage); position: absolute; top: var(--space-3); left: 0; display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border: 1px solid var(--color-border); border-radius: 50%; color: var(--color-muted); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
.timeline__stage:first-child::before { border-style: dashed; }
.timeline__when { font-weight: var(--weight-semibold); }
.timeline__who { color: var(--color-muted); font-size: var(--text-sm); }
.timeline__pillars { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); justify-content: end; }
.pillar-tag { color: var(--color-muted); font-size: var(--text-xs); }
@media (hover: hover) { .pillar-tag:hover { color: var(--color-text); } }
@media (max-width: 800px) {
  .timeline__stage { grid-template-columns: minmax(0, 1fr); gap: var(--space-1); }
  .timeline__pillars { justify-content: start; }
}
</style>
