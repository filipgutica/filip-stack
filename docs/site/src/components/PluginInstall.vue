<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiCodeBlock } from "@filipgutica/ui";
// Install commands for a plugin from one of Filip's GitHub marketplaces, for Claude Code and Codex.
// `anchor` is the id of the Claude Code block, for pages that link to it.
const { marketplace, plugin, anchor } = defineProps<{
  marketplace: string;
  plugin: string;
  anchor?: string;
}>();
const commands = {
  claude: `claude plugin marketplace add filipgutica/${marketplace}\nclaude plugin install ${plugin}@${marketplace}`,
  codex: `codex plugin marketplace add filipgutica/${marketplace}\ncodex plugin add ${plugin}@${marketplace}`,
};
// Copy buttons appear only after hydration, so the page reads cleanly without JavaScript.
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
</script>

<template>
  <div class="cmd-pair">
    <div :id="anchor">
      <p class="cmd-label">Claude Code</p>
      <UiCodeBlock
        :code="commands.claude"
        language="bash"
        variant="compact"
        :copyable="enhanced"
        :wrap="true"
      />
    </div>
    <div>
      <p class="cmd-label">Codex</p>
      <UiCodeBlock
        :code="commands.codex"
        language="bash"
        variant="compact"
        :copyable="enhanced"
        :wrap="true"
      />
      <p class="hint">Restart Codex to load the plugin.</p>
    </div>
  </div>
</template>
