<script setup lang="ts">
import { UiSiteHeader, UiSiteNav } from "@filipgutica/ui/site";
import type { Catalog, CatalogSkill, SkillContent } from "./catalog";
import OverviewPage from "./components/pages/OverviewPage.vue";
import CliPage from "./components/pages/CliPage.vue";
import DesignSystemPage from "./components/pages/DesignSystemPage.vue";
import FieldGuidePage from "./components/pages/FieldGuidePage.vue";
import AgentReadyEnvironmentsPage from "./components/pages/AgentReadyEnvironmentsPage.vue";
import SkillPage from "./components/pages/SkillPage.vue";

const { catalog, page, skill, content } = defineProps<{
  catalog: Catalog;
  page: string;
  skill?: CatalogSkill;
  content?: SkillContent;
}>();
const repository = "https://github.com/filipgutica/filip-stack";
const pages = [
  { label: "Overview", href: "/filip-stack/" },
  { label: "filip-stack CLI", href: "/filip-stack/cli/" },
  { label: "Design system", href: "/filip-stack/design-system/" },
  { label: "Field Guide", href: "/filip-stack/field-guide/" },
  {
    label: "Agent-ready environments",
    href: "/filip-stack/agent-ready-environments/",
  },
];
const groups = [
  { items: pages.map((item) => ({ ...item, current: item.href === page })) },
  ...[
    { label: "Workflow skills", skills: catalog.workflow },
    { label: "Standalone skills", skills: catalog.standalone },
  ].map(({ label, skills }) => ({
    label,
    items: skills.map(({ name }) => ({
      label: name,
      href: `/filip-stack/skills/${name}/`,
      current: skill?.name === name,
      code: true,
    })),
  })),
];
</script>

<template>
  <a class="fg-site-skip" href="#main">Skip to content</a>
  <!-- The library's docs shell: header, rail, main, and footer are direct children. -->
  <div class="fg-site-docs">
    <UiSiteHeader
      project="filip-stack"
      :links="[
        { label: 'GitHub', href: repository },
        { label: 'Releases', href: `${repository}/releases` },
        { label: 'Changelog', href: `${repository}/blob/main/CHANGELOG.md` },
      ]"
    />
    <UiSiteNav label="Documentation" :groups="groups" />
    <main id="main" class="fg-site-prose">
      <SkillPage
        v-if="skill && content"
        :skill="skill"
        :content="content"
        :catalog="catalog"
      />
      <CliPage v-else-if="page === '/filip-stack/cli/'" />
      <DesignSystemPage
        v-else-if="page === '/filip-stack/design-system/'"
      />
      <FieldGuidePage v-else-if="page === '/filip-stack/field-guide/'" />
      <AgentReadyEnvironmentsPage
        v-else-if="page === '/filip-stack/agent-ready-environments/'"
        :catalog="catalog"
      />
      <OverviewPage v-else :catalog="catalog" />
    </main>
    <footer class="fg-site-footer">
      <a href="https://github.com/filipgutica">Built by Filip Gutica</a>
      <nav aria-label="Project links">
        <a :href="`${repository}/blob/main/CHANGELOG.md`">Changelog</a>
        <a :href="`${repository}/issues`">Report an issue</a>
      </nav>
    </footer>
  </div>
</template>
