<script setup lang="ts">
// A numbered figure: one quiet plate for the visual, with its caption below.
// Wide content scrolls inside the plate, never the page.
defineProps<{ number: number }>();
</script>

<template>
  <figure class="lesson-figure">
    <div class="lesson-figure__plate"><slot /></div>
    <figcaption>
      <span class="lesson-figure__number">Figure {{ number }}.</span>
      <slot name="caption" />
    </figcaption>
  </figure>
</template>

<style scoped>
.lesson-figure { display: grid; gap: var(--space-3); margin-block: var(--space-4); }
.lesson-figure__plate { min-width: 0; overflow-x: auto; padding: var(--space-5); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-panel); background: var(--color-surface); }
figcaption { max-width: var(--measure); color: var(--color-muted); font-size: var(--text-sm); }
.lesson-figure__number { color: var(--color-text); font-weight: var(--weight-medium); }
@media (max-width: 680px) { .lesson-figure__plate { padding: var(--space-4); } }
</style>
