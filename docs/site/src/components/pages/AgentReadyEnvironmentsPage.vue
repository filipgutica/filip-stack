<script setup lang="ts">
import type { GuideSection } from "../../agent-ready-guide";

defineProps<{ sections: GuideSection[] }>();
</script>

<template>
  <section
    v-for="(section, index) in sections"
    :key="section.id"
    class="guide-section"
    :class="{ intro: index === 0 }"
    :aria-labelledby="section.id"
    v-html="section.html"
  />
</template>

<style scoped>
.guide-section :deep(a), .guide-section :deep(code) { overflow-wrap: anywhere; }
/* Match the site's command tables, keeping multi-column Markdown tables
   scrollable rather than stacking their cells on phones. */
.guide-section :deep(.guide-table) { max-width: 100%; overflow-x: auto; font-size: var(--text-md); }
.guide-section :deep(table) { width: 100%; border-collapse: collapse; }
.guide-section :deep(th) { padding: 0 var(--space-3) var(--space-2) 0; color: var(--color-muted); font-size: var(--text-sm); font-weight: var(--weight-medium); text-align: start; }
.guide-section :deep(td) { padding: var(--space-3) var(--space-3) var(--space-3) 0; border-top: 1px solid var(--color-border-subtle); vertical-align: top; }
.guide-section :deep(tbody tr:last-child td) { border-bottom: 1px solid var(--color-border-subtle); }
</style>
