<script setup lang="ts">
import { UiBadge } from "@filipgutica/ui";
import type { CatalogSkill } from "../catalog";
const { skills, related = false } = defineProps<{
  skills: CatalogSkill[];
  related?: boolean;
}>();
</script>

<template>
  <ul class="skill-rows">
    <li v-for="skill in skills" :key="skill.name">
      <a :href="`/filip-stack/skills/${skill.name}/`"
        ><code>{{ skill.name }}</code></a
      >
      <p v-html="skill.summaryHtml" />
      <span class="trait" v-if="related">{{ skill.group }}</span>
      <span class="trait" v-else-if="skill.manual"
        ><UiBadge>Manual</UiBadge> · /{{ skill.name }}</span
      >
      <span class="trait" v-else>Picked by request</span>
    </li>
  </ul>
</template>
