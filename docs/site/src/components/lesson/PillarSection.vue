<script setup lang="ts">
import { UiBadge } from "@filipgutica/ui";

// One pillar: why it matters and its audit check stay open; the longer
// "good looks like" list sits in a native disclosure that works without JS.
const { number, title, job, reference, referenceBase } = defineProps<{
  number: number;
  title: string;
  job: "Tell" | "Check" | "Bound";
  /** File name in the skill's references directory; its stem is the anchor. */
  reference: string;
  referenceBase: string;
}>();
const id = reference.replace(/\.md$/, "");
</script>

<template>
  <article class="pillar" :aria-labelledby="id">
    <div class="pillar__head">
      <h3 :id="id">Pillar {{ number }}: {{ title }}</h3>
      <UiBadge>{{ job }}</UiBadge>
    </div>
    <div class="prose"><slot /></div>
    <p class="pillar__check">
      <span class="pillar__label">Audit check</span>
      <slot name="check" />
    </p>
    <details class="pillar__more">
      <summary>What good looks like</summary>
      <div class="prose"><slot name="good" /></div>
    </details>
    <a class="pillar__source" :href="`${referenceBase}${reference}`"
      >Pillar {{ number }} reference in the skill</a
    >
  </article>
</template>

<style scoped>
.pillar { display: grid; gap: var(--space-3); padding-top: var(--space-6); border-top: 1px solid var(--color-border-subtle); }
.pillar__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
.pillar__head h3 { margin: 0; }
.pillar__check { max-width: var(--measure); padding: var(--space-3) var(--space-4); border-left: 3px solid var(--color-accent); border-radius: 0 var(--radius-control) var(--radius-control) 0; background: var(--color-surface); font-size: var(--text-md); }
.pillar__label { display: block; color: var(--color-muted); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.pillar__more { max-width: var(--measure); }
.pillar__more summary { width: fit-content; padding-block: var(--space-2); color: var(--color-text); font-size: var(--text-md); font-weight: var(--weight-medium); cursor: pointer; }
.pillar__more summary::marker { color: var(--color-muted); }
.pillar__more[open] summary { margin-bottom: var(--space-2); }
.pillar__source { justify-self: start; font-size: var(--text-sm); }
</style>
