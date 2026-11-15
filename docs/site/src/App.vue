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
const link = ({ label, href, code = false }: { label: string; href: string; code?: boolean }) => ({
  label,
  href,
  code,
  current: href === page,
});
const skillLink = ({ name }: CatalogSkill) =>
  link({ label: name, href: `/filip-stack/skills/${name}/`, code: true });
// The sidebar order is the reading order: the pager walks it too.
const groups = [
  { items: [link({ label: "Overview", href: "/filip-stack/" })] },
  { label: "Workflow skills", items: catalog.workflow.map(skillLink) },
  { label: "Standalone skills", items: catalog.standalone.map(skillLink) },
  {
    label: "Setup",
    items: [
      link({ label: "filip-stack CLI", href: "/filip-stack/cli/" }),
      link({ label: "Design system", href: "/filip-stack/design-system/" }),
      link({ label: "Field Guide", href: "/filip-stack/field-guide/" }),
    ],
  },
  {
    label: "Guides",
    items: [
      link({ label: "Agent-ready environments", href: "/filip-stack/agent-ready-environments/" }),
    ],
  },
];
const order = groups.flatMap(({ items }) => items);
const position = order.findIndex(({ current }) => current);
const previous = order[position - 1];
const next = order[position + 1];
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
      <nav class="pager" aria-label="Pages">
        <a v-if="previous" rel="prev" :href="previous.href"
          ><span>Previous</span>{{ previous.label }}</a
        >
        <a v-if="next" rel="next" :href="next.href"
          ><span>Next</span>{{ next.label }}</a
        >
      </nav>
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
