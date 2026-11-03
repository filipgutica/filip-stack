<script setup lang="ts">
// A 0–3 score as filled pips, with the number as its accessible text.
const { score, max = 3 } = defineProps<{ score: number; max?: number }>();
</script>

<template>
  <span class="pips">
    <span class="pips__dots" aria-hidden="true">
      <span v-for="index in max" :key="index" :class="{ 'is-on': index <= score }" />
    </span>
    <span class="pips__value">{{ score }}<span class="pips__max">/{{ max }}</span></span>
  </span>
</template>

<style scoped>
.pips { display: inline-flex; align-items: center; gap: var(--space-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
.pips__dots { display: inline-flex; gap: 3px; }
.pips__dots > span { width: 8px; height: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-pill); }
.pips__dots > .is-on { border-color: var(--color-accent); background: var(--color-accent); }
.pips__value { font-weight: var(--weight-medium); }
.pips__max { color: var(--color-muted); font-weight: var(--weight-regular); }
</style>
