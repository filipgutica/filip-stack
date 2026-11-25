<script setup lang="ts">
// The lesson's contents, grouped into the parts of its story so a reader
// sees the whole arc before starting.
defineProps<{
  parts: readonly { label: string; items: readonly { id: string; label: string }[] }[];
}>();
</script>

<template>
  <nav class="contents" aria-labelledby="lesson-contents-title">
    <p id="lesson-contents-title" class="contents__label">In this lesson</p>
    <ol class="contents__parts">
      <li v-for="part in parts" :key="part.label">
        <span class="contents__part">{{ part.label }}</span>
        <ul>
          <li v-for="item in part.items" :key="item.id">
            <a :href="`#${item.id}`">{{ item.label }}</a>
          </li>
        </ul>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.contents { display: grid; gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid var(--color-border-subtle); }
.contents__label { margin: 0; color: var(--color-muted); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.contents__parts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); max-width: none; margin: 0; padding: 0; list-style: none; counter-reset: part; }
.contents__parts > li { display: grid; gap: var(--space-1); align-content: start; counter-increment: part; }
.contents__part { font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.contents__part::before { content: counter(part) ". "; color: var(--color-muted); font-variant-numeric: tabular-nums; }
.contents ul { display: grid; gap: 2px; max-width: none; margin: 0; padding: 0; list-style: none; font-size: var(--text-md); }
.contents a { text-decoration: none; }
.contents a:hover { text-decoration: underline; }
@media (max-width: 800px) { .contents__parts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .contents__parts { grid-template-columns: minmax(0, 1fr); } }
</style>
