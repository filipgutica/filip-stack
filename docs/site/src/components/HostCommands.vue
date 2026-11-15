<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock } from "@filipgutica/ui";
// One command block per host, side by side on wide screens.
const { claude, codex, claudeId } = defineProps<{
  claude: string;
  codex: string;
  /** An anchor on the Claude Code block, for links that jump to it. */
  claudeId?: string;
}>();
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
</script>

<template>
  <div class="cmd-pair">
    <div :id="claudeId">
      <p class="cmd-label">Claude Code</p>
      <UiCodeBlock
        :code="claude"
        language="bash"
        variant="compact"
        :copyable="enhanced"
        :wrap="true"
      />
    </div>
    <div>
      <p class="cmd-label">Codex</p>
      <UiCodeBlock
        :code="codex"
        language="bash"
        variant="compact"
        :copyable="enhanced"
        :wrap="true"
      />
    </div>
  </div>
</template>
