<script setup lang="ts">
import { UiBadge, UiCodeBlock } from "@filipgutica/ui";
import { onMounted, ref } from "vue";
import SkillList from "../SkillList.vue";
import type { Catalog, CatalogSkill, SkillContent } from "../../catalog";
const { skill, content, catalog } = defineProps<{
  skill: CatalogSkill;
  content: SkillContent;
  catalog: Catalog;
}>();
const skills = [...catalog.workflow, ...catalog.standalone];
const relatedSkills = content.related
  .map((name) => skills.find((skill) => skill.name === name))
  .filter((skill) => skill !== undefined);
const position = skills.findIndex(({ name }) => name === skill.name);
const previous = skills[position - 1];
const next = skills[position + 1];
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
const install = `npx skills add filipgutica/filip-stack -g -a claude-code codex -s ${skill.name} -y`;
</script>

<template>
  <section class="intro" aria-labelledby="title">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a
        :href="`/filip-stack/#${skill.group === 'Workflow' ? 'workflow' : 'standalone'}`"
        >{{
          skill.group === "Workflow" ? "Workflow skills" : "Standalone skills"
        }}</a
      >
    </nav>
    <h1 id="title">
      <code>{{ skill.name }}</code>
    </h1>
    <p class="lede" v-html="skill.summaryHtml" />
    <dl class="fg-site-facts">
      <div>
        <dt>{{ skill.group === "Workflow" ? "Plugin" : "Install" }}</dt>
        <dd>{{ skill.group === "Workflow" ? "Workflow" : "On its own" }}</dd>
      </div>
      <div>
        <dt>Runs</dt>
        <dd>
          <template v-if="skill.manual"
            ><UiBadge>Manual</UiBadge> ·
            <code
              >/{{ skill.group === "Workflow" ? "workflow:" : ""
              }}{{ skill.name }}</code
            ></template
          ><template v-else>Picked when a request matches</template>
        </dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd><a :href="skill.source">SKILL.md</a></dd>
      </div>
    </dl>
    <UiCodeBlock
      v-if="skill.group === 'Standalone'"
      :code="install"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
  </section>
  <section
    v-for="section in content.sections"
    :key="section.id"
    :aria-labelledby="section.id"
  >
    <h2 :id="section.id">{{ section.heading }}</h2>
    <div class="prose" v-html="section.html" />
  </section>
  <section aria-labelledby="related" v-if="relatedSkills.length">
    <h2 id="related">Related skills</h2>
    <SkillList :skills="relatedSkills" related />
  </section>
  <nav class="pager" aria-label="Skills">
    <a
      :href="
        previous
          ? `/filip-stack/skills/${previous.name}/`
          : '/filip-stack/field-guide/'
      "
      ><span>Previous</span>{{ previous?.name ?? "Field Guide" }}</a
    >
    <a v-if="next" :href="`/filip-stack/skills/${next.name}/`"
      ><span>Next</span>{{ next.name }}</a
    >
  </nav>
</template>
