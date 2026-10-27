<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { UiCodeBlock } from '@filipgutica/ui';
import { UiSiteHeader } from '@filipgutica/ui/site';
import SiteNavigation from './components/SiteNavigation.vue';
import type { Catalog } from './catalog';

const { catalog } = defineProps<{ catalog: Catalog }>();

const repository = 'https://github.com/filipgutica/filip-stack';
const readme = `${repository}#readme`;
const enhanced = ref(false);

const install = {
  claude: [
    'claude plugin marketplace add filipgutica/filip-stack',
    'claude plugin install workflow@filip-stack',
  ].join('\n'),
  codex: [
    'codex plugin marketplace add filipgutica/filip-stack',
    'codex plugin add workflow@filip-stack',
  ].join('\n'),
};
const cloneCommand = 'git clone https://github.com/filipgutica/filip-stack.git ~/code/filip-stack';
const linkCommand = [
  'mkdir -p ~/.local/bin',
  'ln -s ~/code/filip-stack/scripts/host-config.mjs ~/.local/bin/filip-stack',
].join('\n');
const skillCommand = 'npx skills add filipgutica/filip-stack -g -a claude-code codex -s <name> -y';
const hostCommands = [
  { code: 'filip-stack status', summary: 'Show the applied commit and the state of each target.' },
  { code: 'filip-stack apply', summary: 'Write the targets and import shared Field Guide guidance.' },
  { code: 'filip-stack update', summary: 'On main only: pull the checkout, then apply.' },
  { code: 'filip-stack field-guide-sync', summary: 'Import, then export local shared guidance for review.' },
];

onMounted(() => {
  enhanced.value = true;
});
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>
  <div class="page" :data-enhanced="enhanced">
    <UiSiteHeader
      class="page-header"
      project="filip-stack"
      :links="[
        { label: 'Guide', href: readme },
        { label: 'GitHub', href: repository },
        { label: 'Releases', href: `${repository}/releases` },
      ]"
    />
    <SiteNavigation />
    <main id="main">
      <section class="hero" aria-labelledby="title">
        <h1 id="title" class="tagline">Skills and setup for Claude and Codex.</h1>
        <p class="lede">
          A small engineering workflow, optional local memory, standalone skills,
          and the shared guidance that sets up each machine.
        </p>
        <div class="install-grid">
          <div id="install" class="install-command">
            <p class="hint">Install in Claude Code</p>
            <UiCodeBlock :code="install.claude" language="bash" variant="compact" :copyable="enhanced" :wrap="true" />
          </div>
          <div class="install-command">
            <p class="hint">Install in Codex</p>
            <UiCodeBlock :code="install.codex" language="bash" variant="compact" :copyable="enhanced" :wrap="true" />
          </div>
        </div>
        <dl class="facts">
          <div>
            <dt>Hosts</dt>
            <dd>Claude Code and Codex</dd>
          </div>
          <div>
            <dt>Skills</dt>
            <dd>{{ catalog.workflow.length }} Workflow, {{ catalog.standalone.length }} standalone</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd><a :href="repository">filipgutica/filip-stack</a></dd>
          </div>
        </dl>
      </section>

      <section class="split" aria-labelledby="parts">
        <header>
          <h2 id="parts">What is included</h2>
          <p>Four parts. Install only the ones you need.</p>
        </header>
        <ul class="rows parts">
          <li class="row">
            <a href="#workflow">Workflow</a>
            <p>Nine skills for the engineering loop. A plugin from this marketplace.</p>
          </li>
          <li class="row">
            <a href="#skills">Standalone skills</a>
            <p>Independent skills, each installed with the skills CLI.</p>
          </li>
          <li class="row">
            <a href="#field-guide">Field Guide</a>
            <p>Optional local memory of preferences and lessons. A plugin.</p>
          </li>
          <li class="row">
            <a href="#host-config">Host config</a>
            <p>Global guidance, agents, output styles, and design language, applied from a checkout.</p>
          </li>
        </ul>
      </section>

      <section class="split" aria-labelledby="setup">
        <header>
          <h2 id="setup">Set up a machine</h2>
          <p>Host config applies from a checkout on <code>main</code>.</p>
        </header>
        <ol class="steps">
          <li>
            <p>Clone the repository.</p>
            <UiCodeBlock :code="cloneCommand" language="bash" variant="compact" :copyable="enhanced" :wrap="true" />
          </li>
          <li>
            <p>Install the plugins in Claude Code or Codex with the commands <a href="#install">above</a>.</p>
          </li>
          <li>
            <p>Install the <a href="#skills">standalone skills</a> you use.</p>
          </li>
          <li>
            <p>Put the host config command on your <code>PATH</code>, then run <code>filip-stack apply</code>.</p>
            <UiCodeBlock :code="linkCommand" language="bash" variant="compact" :copyable="enhanced" :wrap="true" />
          </li>
        </ol>
      </section>

      <section class="split" aria-labelledby="workflow">
        <header>
          <h2 id="workflow">Workflow</h2>
          <p>
            The host sees only each skill's name and description. A selected skill
            opens one short reference only when its mode needs it.
          </p>
        </header>
        <div class="stack">
          <ol class="loop" aria-label="The engineering loop">
            <li>Define the boundary</li>
            <li>Establish a test or reproduction</li>
            <li>Make the smallest correct change</li>
            <li>Run focused checks</li>
            <li>Inspect the complete diff</li>
            <li>Review consequential decisions</li>
          </ol>
          <p class="hint">
            Failed evidence returns only to the affected step, and stop conditions
            prevent unbounded retries.
          </p>
          <ul class="rows skills">
            <li v-for="skill in catalog.workflow" :key="skill.name" class="row">
              <code>{{ skill.name }}</code>
              <p v-html="skill.summaryHtml" />
              <span class="mode">{{ skill.manual ? `/workflow:${skill.name}` : 'Selected by request' }}</span>
            </li>
          </ul>
          <p class="hint">
            Codex uses <code>$workflow:&lt;name&gt;</code> for manual skills.
          </p>
        </div>
      </section>

      <section class="split" aria-labelledby="skills">
        <header>
          <h2 id="skills">Standalone skills</h2>
          <p>
            Each installs on its own into <code>~/.agents/skills</code>, with a
            link for Claude.
          </p>
        </header>
        <div class="stack">
          <UiCodeBlock :code="skillCommand" language="bash" variant="compact" :copyable="enhanced" :wrap="true" />
          <ul class="rows skills">
            <li v-for="skill in catalog.standalone" :key="skill.name" class="row">
              <code>{{ skill.name }}</code>
              <p v-html="skill.summaryHtml" />
              <span class="mode">{{ skill.manual ? `/${skill.name}` : 'Selected by request' }}</span>
            </li>
          </ul>
          <p class="hint">
            To refresh a skill, run the same command again. Avoid
            <code>npx skills update</code>: it reinstalls into every agent it detects.
          </p>
        </div>
      </section>

      <section class="split" aria-labelledby="field-guide">
        <header>
          <h2 id="field-guide">Field Guide</h2>
          <p>Optional. Workflow does not depend on it.</p>
        </header>
        <div class="text-rows">
          <p>
            Field Guide keeps durable preferences, corrections, and recurring lessons
            under <code>~/.field-guide</code>. At session start and on the first
            prompt, it adds the stored guidance that matches the work. Current
            instructions and live code still outrank it.
          </p>
          <p>
            Install <code>field-guide@filip-stack</code> the same way as Workflow.
            Leaving it out keeps its lifecycle hooks out of your sessions.
          </p>
        </div>
      </section>

      <section class="split" aria-labelledby="host-config">
        <header>
          <h2 id="host-config">Host config</h2>
          <p>
            The general agent setup shared by every machine. It ships from
            <code>main</code> without a version.
          </p>
        </header>
        <div class="stack">
          <ul class="rows">
            <li v-for="command in hostCommands" :key="command.code" class="row">
              <div class="cmd">
                <UiCodeBlock :code="command.code" language="bash" variant="compact" :copyable="enhanced" :wrap="true" />
              </div>
              <p>{{ command.summary }}</p>
            </li>
          </ul>
          <dl class="definitions">
            <dt>Guidance</dt>
            <dd>A marked block in <code>~/.claude/CLAUDE.md</code> and <code>~/.codex/AGENTS.md</code>. Text outside the block stays local.</dd>
            <dt>Agents</dt>
            <dd>Claude agent templates and output styles, and Codex agent profiles.</dd>
            <dt>Shared files</dt>
            <dd><code>~/.agents/roles.md</code>, <code>~/.agents/CODING_STANDARDS.md</code>, and <code>~/design-language</code>.</dd>
            <dt>Local edits</dt>
            <dd>Apply shows the diff and stops. <code>--force</code> saves a <code>.bak</code> copy, then overwrites.</dd>
          </dl>
          <nav class="links" aria-label="Host config documentation">
            <a :href="`${repository}#host-config`">Host config reference</a>
            <a href="https://github.com/filipgutica/pluginbench">How skills are evaluated</a>
          </nav>
        </div>
      </section>
    </main>
    <footer>
      <a href="https://github.com/filipgutica">Built by Filip Gutica</a>
      <nav aria-label="Project links">
        <a :href="`${repository}/blob/main/CHANGELOG.md`">Changelog</a>
        <a :href="`${repository}/issues`">Report an issue</a>
      </nav>
    </footer>
  </div>
</template>
