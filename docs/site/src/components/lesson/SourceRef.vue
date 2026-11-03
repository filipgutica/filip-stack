<script setup lang="ts">
import { sources, type SourceKey } from "./sources";

// One or more citation keys, linked to the lesson's Sources list.
const { keys } = defineProps<{ keys: SourceKey[] }>();
</script>

<template>
  <span class="cite"
    >[<template v-for="(key, index) in keys" :key="key"
      ><template v-if="index">, </template
      ><a :href="`#source-${key.toLowerCase()}`" :title="sources[key].title">{{
        key
      }}</a></template
    >]</span
  >
</template>

<style scoped>
.cite { color: var(--color-muted); font-size: 0.8em; white-space: nowrap; }
.cite a { color: inherit; text-decoration: none; }
.cite a:hover { color: var(--color-link); text-decoration: underline; }
</style>
