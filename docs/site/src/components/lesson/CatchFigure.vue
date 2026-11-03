<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { UiBadge } from "@filipgutica/ui";

// An illustrative change with one hidden problem per safeguard. Without
// JavaScript, each problem lists both outcomes; after hydration, the reader
// turns safeguards on and sees one outcome at a time.
const safeguards = [
  { id: "check", label: "One check command", pillar: 2 },
  { id: "tests", label: "Tests with signal", pillar: 3 },
  { id: "app", label: "Seeded app, one command", pillar: 6 },
  { id: "deny", label: "Deny rule on secrets", pillar: 7 },
] as const;
type SafeguardId = (typeof safeguards)[number]["id"];

const problems: {
  text: string;
  safeguard: SafeguardId;
  without: string;
  with: string;
  missed: string;
  stopped: string;
}[] = [
  {
    text: "Stores the due date as text where the form expects a date.",
    safeguard: "check",
    without: "Nothing checks types. You spot it in review.",
    with: "The type check fails, and the agent fixes it before it says done.",
    missed: "Reaches you",
    stopped: "Agent fixes it",
  },
  {
    text: "Marks tasks that are due today as overdue.",
    safeguard: "tests",
    without: "Nothing exercises the rule. A user reports it.",
    with: "A test for the overdue rule fails, and the agent fixes the comparison.",
    missed: "Reaches you",
    stopped: "Agent fixes it",
  },
  {
    text: "Crashes the task page when a task has no due date.",
    safeguard: "app",
    without: "The agent never opens the page. You find the crash when you try it.",
    with: "The agent starts the app with seeded tasks, including one with no due date, and sees the crash.",
    missed: "Reaches you",
    stopped: "Agent fixes it",
  },
  {
    text: "Reads the .env file to borrow an API key for a quick test.",
    safeguard: "deny",
    without: "Nothing stops it, and nobody notices.",
    with: "The deny rule blocks the read, so the agent asks for a test key.",
    missed: "Nobody notices",
    stopped: "Blocked",
  },
];
const enhanced = ref(false);
const enabled = ref(new Set<SafeguardId>());
const toggle = (id: SafeguardId) => {
  const next = new Set(enabled.value);
  if (!next.delete(id)) next.add(id);
  enabled.value = next;
};
// What each problem shows: both outcomes before hydration, the current one after.
const rows = computed(() =>
  problems.map((problem) => {
    const safeguard = safeguards.find(({ id }) => id === problem.safeguard)!;
    const stopped = enabled.value.has(problem.safeguard);
    return {
      ...problem,
      safeguardName: `${safeguard.label.toLowerCase()} (pillar ${safeguard.pillar})`,
      stopped,
      status: stopped ? problem.stopped : problem.missed,
      tone: stopped ? "success" : problem.safeguard === "deny" ? "error" : "warning",
      outcome: stopped ? problem.with : problem.without,
    } as const;
  }),
);
const tally = computed(() => {
  const missed = rows.value.filter(({ stopped }) => !stopped).length;
  if (!missed)
    return `All ${problems.length} are stopped before the agent says done. You review a change that already passed its checks.`;
  const suffix = missed === problems.length ? ", so you are the test suite" : "";
  return `${missed} of ${problems.length} problems get past the agent${suffix}.`;
});
onMounted(() => {
  enhanced.value = true;
});
</script>

<template>
  <div class="catch" :class="{ 'is-enhanced': enhanced }">
    <p class="catch__scenario">
      <span class="catch__label">Illustrative task</span>
      “Add a due date to tasks.” The agent edits the code, the build passes, and
      it reports done. Four problems are hiding in the change.
    </p>
    <div class="catch__body">
      <div v-if="enhanced" class="catch__controls">
        <p id="catch-controls-label" class="catch__label">
          Turn on parts of the environment
        </p>
        <div role="group" aria-labelledby="catch-controls-label">
          <button
            v-for="safeguard in safeguards"
            :key="safeguard.id"
            type="button"
            :aria-pressed="enabled.has(safeguard.id)"
            @click="toggle(safeguard.id)"
          >
            <span class="catch__switch" aria-hidden="true" />
            <span>
              {{ safeguard.label }}
              <small>Pillar {{ safeguard.pillar }}</small>
            </span>
          </button>
        </div>
      </div>
      <div class="catch__results">
        <ul class="catch__problems">
          <li
            v-for="row in rows"
            :key="row.safeguard"
            :class="{ 'is-stopped': enhanced && row.stopped }"
          >
            <p class="catch__problem">{{ row.text }}</p>
            <p v-if="enhanced" class="catch__outcome">
              <UiBadge :tone="row.tone">{{ row.status }}</UiBadge>
              <span>{{ row.outcome }}</span>
            </p>
            <dl v-else class="catch__both">
              <dt>Without it</dt>
              <dd>{{ row.without }}</dd>
              <dt>With {{ row.safeguardName }}</dt>
              <dd>{{ row.with }}</dd>
            </dl>
          </li>
        </ul>
        <p v-if="enhanced" class="catch__tally" aria-live="polite">
          {{ tally }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catch { display: grid; gap: var(--space-5); font-size: var(--text-md); }
.catch :where(p, ul, dl) { margin: 0; }
.catch__body { display: grid; gap: var(--space-5); }
.is-enhanced .catch__body { grid-template-columns: 14rem minmax(0, 1fr); align-items: start; }
.catch__results { display: grid; gap: var(--space-4); }
.catch__label { display: block; color: var(--color-muted); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.catch__scenario { max-width: var(--measure); }
.catch__controls { display: grid; gap: var(--space-2); }
.catch__controls [role='group'] { display: grid; gap: var(--space-2); }
.catch__controls button { display: flex; align-items: center; gap: var(--space-3); min-height: var(--control-lg); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); color: var(--color-text); font: var(--text-md) / var(--leading-tight) var(--font-ui); text-align: left; cursor: pointer; }
.catch__controls button:hover { border-color: var(--color-border); }
.catch__controls button[aria-pressed='true'] { border-color: var(--color-accent); }
.catch__controls small { display: block; color: var(--color-muted); font-size: var(--text-xs); }
/* The thumb's position, not only its color, shows the state. */
.catch__switch { position: relative; flex: none; width: 28px; height: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-pill); background: var(--color-surface-muted); }
.catch__switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: var(--radius-pill); background: var(--color-border); }
[aria-pressed='true'] .catch__switch { border-color: var(--color-accent); background: var(--color-accent); }
[aria-pressed='true'] .catch__switch::after { left: 14px; background: var(--color-button-text); }
.catch__problems { display: grid; max-width: none; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.catch__problems > li { display: grid; gap: var(--space-1); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-border-subtle); border-left: 3px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface-raised); }
.catch__problems > li.is-stopped { border-left-color: var(--color-success); }
.catch__problem { font-weight: var(--weight-medium); }
.catch__outcome { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr); align-items: baseline; gap: var(--space-1) var(--space-3); color: var(--color-muted); }
.catch__outcome > :first-child { justify-self: start; }
.catch__both { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: var(--space-1) var(--space-4); margin: 0; color: var(--color-muted); }
.catch__both dt { color: var(--color-text); }
.catch__both dd { margin: 0; }
.catch__tally { padding-top: var(--space-1); }
@media (prefers-reduced-motion: no-preference) {
  .catch__switch, .catch__switch::after, .catch__problems > li { transition: all var(--duration) var(--ease-out); }
}
@media (max-width: 800px) {
  .is-enhanced .catch__body { grid-template-columns: minmax(0, 1fr); }
  .catch__controls [role='group'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .catch__both, .catch__outcome { grid-template-columns: minmax(0, 1fr); }
  .catch__both dd + dt { margin-top: var(--space-2); }
}
</style>
