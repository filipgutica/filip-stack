<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiAlert, UiBadge, UiBreadcrumbs, UiCodeBlock, UiFigure, UiScore, UiTabs } from "@filipgutica/ui";
import type { Catalog } from "../../catalog";
import CatchFigure from "../lesson/CatchFigure.vue";
import PillarSection from "../lesson/PillarSection.vue";
import { sources } from "../lesson/sources";
import { lessonPillars, maintenanceFile } from "../lesson/pillars";

// This lesson is written for people. The skill it teaches is written for
// agents. getStaticPaths checks that every reference linked here exists.
const { catalog } = defineProps<{ catalog: Catalog }>();
const skill = catalog.standalone.find(
  ({ name }) => name === "agent-ready-environments",
);
if (!skill) throw new Error("The lesson's skill, agent-ready-environments, is missing.");
const referenceBase = skill.source.replace(/SKILL\.md$/, "references/");
const repository = "https://github.com/filipgutica/filip-stack";
const install =
  "npx skills add filipgutica/filip-stack -g -a claude-code codex -s agent-ready-environments -y";
const contents = [
  { id: "why-agents-stop-early", label: "Why agents stop early" },
  { id: "tell-check-bound", label: "Three jobs: tell, check, bound" },
  { id: "placement-advisory-or-enforced", label: "Advisory or enforced" },
  { id: "durable-and-decaying-guidance", label: "Durable and decaying guidance" },
  { id: "the-pillars", label: "The eight pillars" },
  { id: "audit-procedure", label: "Audit a repository" },
  { id: "worked-example", label: "Worked example: this repository" },
  { id: "where-to-start", label: "Where to start" },
  { id: "maintenance", label: "Keeping guidance current" },
];
const scorecard = [
  {
    pillar: 7,
    name: "Bounded autonomy",
    gap: "The no-AI-attribution rule was text-only, and a session reminder contradicted it.",
    fix: "Hook blocking attribution trailers, plus approval rules for merges and 1Password.",
    channel: "Enforced",
  },
  {
    pillar: 6,
    name: "Reproducible environment",
    gap: "A fresh worktree could not install dependencies inside the sandbox.",
    fix: "Share dependencies into worktrees or narrow the sandbox rule. Document setup in AGENTS.md and add PR site previews.",
    channel: "Enforced and advisory",
  },
  {
    pillar: 3,
    name: "Test gates",
    gap: "No 20-test sample, no single-test command in AGENTS.md, and an unverified flake rate.",
    fix: "Run the sample and add node --test <file> to AGENTS.md.",
    channel: "Advisory",
  },
  {
    pillar: 2,
    name: "Static gates",
    gap: "About 4,700 lines of root scripts and tests had no static check.",
    fix: "Add a type check or Fallow to pnpm check.",
    channel: "Enforced",
  },
  {
    pillar: 5,
    name: "Review gates",
    gap: "No read-only, fresh-context reviewer ran on pull requests.",
    fix: "Decide if a risk-triggered reviewer is worth its cost.",
    channel: "Enforced",
  },
  {
    pillar: 1,
    name: "Code shape",
    gap: "Boundary checks passed, but no duplication tool ran.",
    fix: "Run Fallow, as in pillar 2.",
    channel: "Enforced",
  },
  {
    pillar: 8,
    name: "Guidance evaluated",
    gap: "Workflow skills had baseline studies. Global guidance had none.",
    fix: "Run the decay test on global guidance.",
    channel: "Advisory",
  },
  {
    pillar: 4,
    name: "Documentation",
    gap: "Some documented commands were never run, and global guidance was untested for decay.",
    fix: "Prune global guidance with the decay test.",
    channel: "Advisory",
  },
];
const pillars = lessonPillars.map(({ file, ...pillar }) => ({
  ...pillar,
  reference: file,
}));
const pillar = (number: number) => pillars[number - 1]!;
const pillarMap = (["Tell", "Check", "Bound"] as const).map((job) => ({
  job,
  pillars: pillars.filter((pillar) => pillar.job === job),
}));
// Figure 5 numbers the fix steps 1 to 8 across both groups. The pillar
// number is a separate tag, so readers do not take it for a position.
const fixOrder = [
  { label: "First, by blast radius", start: 1, pillars: [7] },
  { label: "Then by durability", start: 2, pillars: [6, 3, 2, 5, 1, 8, 4] },
];
// The new-project mode is the list under "Where to start", so the tabs hold
// only the two audit modes for work that already exists.
const modes = [
  { value: "existing", label: "Existing repository" },
  { value: "guidance", label: "Engineering guidance" },
];
const mode = ref("existing");
const enhanced = ref(false);
onMounted(() => {
  enhanced.value = true;
});
</script>

<template>
  <section class="intro" aria-labelledby="agent-ready-environments">
    <UiBreadcrumbs
      :items="[{ label: 'Overview', href: '/filip-stack/' }, { label: 'Agent-ready environments' }]"
    />
    <h1 id="agent-ready-environments">Agent-ready environments</h1>
    <p class="lede">
      An agent-ready environment gives a coding agent the checks, setup, and
      limits to verify its own work. Without one, you become its test suite.
      Learn the eight areas it covers, how audits score them, and how to start.
    </p>
    <p>
      In a hurry? Go to <a href="#where-to-start">Where to start</a>.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Reading time</dt>
        <dd>About 15 minutes</dd>
      </div>
      <div>
        <dt>Companion skill</dt>
        <dd>
          <a href="/filip-stack/skills/agent-ready-environments/"
            ><code>agent-ready-environments</code></a
          >
        </dd>
      </div>
    </dl>
    <nav class="lesson-contents" aria-labelledby="lesson-contents-title">
      <p id="lesson-contents-title" class="lesson-label">In this lesson</p>
      <ol>
        <li v-for="item in contents" :key="item.id">
          <a :href="`#${item.id}`">{{ item.label }}</a>
        </li>
      </ol>
    </nav>
  </section>

  <section aria-labelledby="why-agents-stop-early">
    <h2 id="why-agents-stop-early">Why agents stop early</h2>
    <div class="prose">
      <p>
        A coding agent edits files, runs available checks, and stops when work
        <em>looks</em> done. Tests and type checks catch code errors, a running
        app preloaded with sample data reveals page bugs, and deny rules block
        secret files.
      </p>
    </div>
    <UiFigure class="lesson-figure" :number="1">
      <CatchFigure />
      <template #caption>
        Who catches it? The same change with and without four parts of an
        agent-ready environment. Illustrative scenario.
      </template>
    </UiFigure>
  </section>

  <section aria-labelledby="tell-check-bound">
    <h2 id="tell-check-bound">Three jobs: tell, check, bound</h2>
    <div class="prose">
      <p>
        An agent-ready environment has eight areas, called pillars. Each does
        one of three jobs.
      </p>
    </div>
    <dl class="jobs">
      <div>
        <dt>Tell</dt>
        <dd>
          Give the agent what the code cannot show, such as avoiding an old
          helper or which command runs every check.
        </dd>
      </div>
      <div>
        <dt>Check</dt>
        <dd>
          Return pass or fail through a type checker, tests, or a setup health
          check.
        </dd>
      </div>
      <div>
        <dt>Bound</dt>
        <dd>
          Limit what the agent can touch and name who approves results, such as
          blocking <code>.env</code> files or requiring merge approval.
        </dd>
      </div>
    </dl>
    <div class="prose">
      <p>
        In Figure 1, the check command, tests, and seeded app check the work,
        while the deny rule bounds it. Written rules only tell. They cannot
        verify results.
      </p>
    </div>
  </section>

  <section aria-labelledby="placement-advisory-or-enforced">
    <h2 id="placement-advisory-or-enforced">Advisory or enforced</h2>
    <div class="prose">
      <p>
        <strong>Advisory</strong> guidance is text: prompts,
        <code>AGENTS.md</code> or <code>CLAUDE.md</code>, and skills. The agent
        may skip it. <strong>Enforced</strong> checks, like hooks or required
        CI, run at a tool call, commit, or merge regardless.
      </p>
    </div>
    <UiFigure class="lesson-figure" :number="2">
      <ol class="channels" aria-label="How a rule reaches an action">
        <li class="channels__advisory">
          <span class="lesson-label">Advisory</span>
          <span>Prompt, <code>AGENTS.md</code>, skills</span>
        </li>
        <li>
          <span class="lesson-label">The agent</span>
          <span>Weighs the guidance and decides what to do</span>
        </li>
        <li class="channels__enforced">
          <span class="lesson-label">Enforced, at the boundary</span>
          <span>Hooks, deny rules, sandbox, type checker, required CI</span>
        </li>
        <li>
          <span class="lesson-label">The action</span>
          <span>Runs the tool call, commit, or merge, or blocks it</span>
        </li>
      </ol>
      <template #caption>
        Enforced checks run between decision and action, whatever the agent
        chose.
      </template>
    </UiFigure>
    <div class="prose">
      <p>Choose advisory or enforced by the rule's exceptions.</p>
      <ul>
        <li>
          Enforce rules with no exceptions. When text fails, put the rule in
          code, as OpenAI's
          <a :href="sources.harnessEngineering.href">harness engineering article</a>
          describes.
        </li>
        <li>
          When an agent keeps missing an advisory line, enforce it if it has no
          exceptions, or shorten the file. Emphasis fixes neither.
        </li>
        <li>
          Keep preferences advisory. Hooks sometimes block valid actions and
          need upkeep, so a large enforced set means preferences leaked in.
        </li>
        <li>
          Write error messages that state how to fix the failure.
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="durable-and-decaying-guidance">
    <h2 id="durable-and-decaying-guidance">Durable and decaying guidance</h2>
    <div class="prose">
      <p>
        Guidance covering model weaknesses loses value as models improve.
        Guidance giving models what they cannot get alone lasts.
        <a :href="sources.claudeCodeBestPractices.href">Anthropic's Claude Code best practices</a>
        now include “What you can stop doing.”
      </p>
    </div>
    <div class="lesson-table">
      <table>
        <thead>
          <tr>
            <th scope="col">Decaying: makes up for the model</th>
            <th scope="col">Durable: gives the model what it cannot get</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Emphasis, <code>IMPORTANT</code>, ALL CAPS</td>
            <td>Facts that are not in the repository</td>
          </tr>
          <tr>
            <td>“Think harder”, “keep going”, “don't be lazy”</td>
            <td>A check that returns pass or fail</td>
          </tr>
          <tr>
            <td>Architecture tours and file-layout descriptions</td>
            <td>Deterministic enforcement of rules with no exceptions</td>
          </tr>
          <tr>
            <td>Aggressive context management</td>
            <td>A running, observable, seeded environment</td>
          </tr>
          <tr>
            <td>Delegating to a subagent “for a better answer”</td>
            <td>An independent reviewer that did not see the author's reasoning</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="prose">
      <p>
        A reproducible environment (pillar 6) lasts longest: no model can
        inspect an unstarted app. Static and test gates follow. Documentation
        shrinks as models read code better.
      </p>
    </div>
  </section>

  <section aria-labelledby="the-pillars">
    <h2 id="the-pillars">The eight pillars</h2>
    <div class="prose">
      <p>
        Each pillar does one job and has a verifiable audit check. Its linked
        reference has full criteria.
      </p>
    </div>
    <UiFigure class="lesson-figure" :number="3">
      <ul class="pillar-map">
        <li v-for="group in pillarMap" :key="group.job">
          <span class="lesson-label">{{ group.job }}</span>
          <ul>
            <li v-for="pillar in group.pillars" :key="pillar.number">
              <a :href="`#${pillar.reference.replace(/\.md$/, '')}`"
                >{{ pillar.title }}
                <span class="pillar-tag">Pillar {{ pillar.number }}</span></a
              >
            </li>
          </ul>
        </li>
      </ul>
      <template #caption>
        The pillars by job. Select one to jump to it.
      </template>
    </UiFigure>

    <PillarSection
      v-bind="pillar(1)"
      :reference-base="referenceBase"
    >
      <p>
        Agents copy patterns they find, including ones you are replacing. With
        one pattern per job, the nearest example is right.
      </p>
      <template #check>
        In three recent features, each decision (such as validation or
        permissions) lives in one place. Duplication and boundary tools pass.
      </template>
      <template #good>
        <ul>
          <li>One module owns each concept, and others call it.</li>
          <li>Tools enforce dependency direction: dependency-cruiser, import-linter, Go <code>internal/</code> packages, or ArchUnit.</li>
          <li>Legacy areas say “do not copy,” enforced where possible with a lint rule banning old imports.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(2)"
      :reference-base="referenceBase"
    >
      <p>
        The command running types and lint is the most useful line in an
        instruction file. A <code>Stop</code> hook makes running it required
        before finishing.
      </p>
      <template #check>
        One command runs every static check locally and in CI. Clean
        <code>main</code> passes, and you count suppressions by kind: inline
        directives, rules turned off in config, and allowlist entries.
      </template>
      <template #good>
        <ul>
          <li>Strict types: TypeScript <code>strict</code>, mypy or Pyright strict, <code>go vet</code> with staticcheck, Clippy denying warnings.</li>
          <li>Lint, dead code, unused dependencies, complexity, and duplication checks.</li>
          <li>Warnings fail builds, and every suppression states why.</li>
          <li>Error messages say how to fix failures.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(3)"
      :reference-base="referenceBase"
    >
      <p>
        Agents often stop after unit tests or a <code>curl</code> call, yet
        catch more bugs testing end to end. A test that cannot fail gives false
        confidence.
      </p>
      <template #check>
        One command runs a single test file. Sampled tests each verify one
        behavior and guard against one realistic regression.
      </template>
      <template #good>
        <ul>
          <li>Each layer owns one risk: unit for pure logic, component for public contracts, integration for real boundaries, and end-to-end for key user journeys.</li>
          <li>Regression tests fail before the fix.</li>
          <li>Mutation testing on critical modules proves tests can fail.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(4)"
      :reference-base="referenceBase"
    >
      <p>
        Files loaded into every session cost attention on every task. For each
        line, ask: could the agent find this in the code, and would it look? If
        yes to both, delete it. Keep check commands anyway. For global rules,
        use the <a href="#maintenance">decay test</a>.
      </p>
      <template #check>
        Every always-loaded line passes the two-question or decay test, and
        every documented command runs.
      </template>
      <template #good>
        <ul>
          <li>Always-loaded files list install, single-test, typecheck, lint, and run commands, plus non-obvious decisions and mistakes corrected twice.</li>
          <li>Repeated procedures live in skills, loaded only when needed.</li>
          <li>Skip directory layouts: agents find them fast, and descriptions go stale.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(5)"
      :reference-base="referenceBase"
    >
      <p>
        A reviewer in a fresh context never saw the author's reasoning. Asked
        to find problems, models always find some, and fixing all adds needless
        code. Say what to skip.
      </p>
      <template #check>
        Each review check (such as security) has a trigger, runs read-only in
        fresh context, and has findings verified before fixes.
      </template>
      <template #good>
        <ul>
          <li>Leave anything a tool can check to pillar 2.</li>
          <li>Check every change against its spec or ticket. Run angles like security or performance only when the diff carries that risk.</li>
          <li>A person authorizes merges, per PR or in advance under pillar 7.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(6)"
      :reference-base="referenceBase"
    >
      <p>
        Agents need a running app with realistic test data. A setup failure may
        not stop them:
        <a :href="sources.copilotEnvironment.href">GitHub's Copilot documentation</a>
        notes it continues in a partial environment. End setup with a health
        check.
      </p>
      <template #check>
        Inside the agent's sandbox, one command starts a seeded, healthy app
        from a fresh git worktree. Two worktrees run at once without
        collisions.
      </template>
      <template #good>
        <ul>
          <li>A repeatable seed loads key states (empty, error, each permission level) with no production personal data.</li>
          <li>Agents observe the app via browser automation, logs, and traces.</li>
          <li>Guidance repositories use a throwaway host home and a harness that runs agents against it.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(7)"
      :reference-base="referenceBase"
    >
      <p>
        Before unattended runs, answer five questions: What counts as done? Can
        it check itself? What may it touch? What stops it? Where does the
        result go, and who signs off? Put never-break rules in deny rules,
        hooks, or the sandbox, because a safety classifier can be wrong.
      </p>
      <template #check>
        Every “never” rule is a deny rule, hook, or sandbox limit. Unattended
        runs have turn or spend caps and named sign-off.
      </template>
      <template #good>
        <ul>
          <li>Deny rules block secrets and protected paths.</li>
          <li>Worktrees or containers isolate runs with least-privilege tokens.</li>
          <li>A person authorizes merges, deploys, and irreversible actions, either per action or in advance with stated scope, enforced limits, a run cap, and named sign-off. Skipping repeated prompts is not a gap.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(8)"
      :reference-base="referenceBase"
    >
      <p>
        <a :href="sources.skillAuthoring.href">Anthropic's skill authoring guide</a>
        says to measure the agent without guidance first, then add the minimum
        needed to fix observed failures. Test every target model: one may need
        an instruction another does not.
      </p>
      <template #check>
        Each instruction file or skill has evidence that it changes behavior
        compared with no guidance.
      </template>
      <template #good>
        <ul>
          <li>Evaluations compare guidance against none on matched tasks, model, and harness.</li>
          <li>Routing checks confirm skill descriptions trigger when expected.</li>
          <li>Pruning deletes instructions the current model already follows.</li>
        </ul>
      </template>
    </PillarSection>
  </section>

  <section aria-labelledby="audit-procedure">
    <h2 id="audit-procedure">Audit a repository</h2>
    <div class="prose">
      <p>
        An audit turns the eight pillar checks into scores and a fix list.
      </p>
    </div>
    <h3 id="scoring">How a pillar is scored</h3>
    <UiFigure class="lesson-figure" :number="4">
      <ol class="ladder" aria-label="Score levels">
        <li>
          <span class="ladder__score">0</span>
          <strong>Absent</strong>
          <span>Missing, or no verified evidence.</span>
        </li>
        <li>
          <span class="ladder__score">1</span>
          <strong>Present</strong>
          <span>Policy, script, or partial setup with a level 2 check unmet or unverified.</span>
        </li>
        <li>
          <span class="ladder__score">2</span>
          <strong>Runnable</strong>
          <span>The audit check passes when run. Only pillar 6 requires a fresh checkout.</span>
        </li>
        <li>
          <span class="ladder__score">3</span>
          <strong>Enforced and measured</strong>
          <span>Blocks the guarded action, with results tracked over at least 20 runs or 30 days.</span>
        </li>
      </ol>
      <template #caption>
        Each level builds on the last. Required CI blocking merge, or a
        blocking hook, is enforced. Optional CI stays at level 2.
      </template>
    </UiFigure>
    <div class="prose">
      <p>
        Give each pillar the highest score its verified evidence meets. Checks
        you could not run stay Unverified and cannot raise scores.
      </p>
    </div>
    <details class="lesson-disclosure">
      <summary>Scoring rules for auditing without the skill</summary>
      <div class="prose">
        <p>
          <a :href="skill.source">SKILL.md</a> has the full rubric, and each
          pillar reference has detailed checks. Three rules matter most by
          hand:
        </p>
        <ul>
          <li>When a pillar covers several artifacts, such as a file, skill, or review angle, score the weakest applicable artifact.</li>
          <li>Mark a pillar N/A when it does not apply, with a one-line reason, and leave it out of the total.</li>
          <li>Strongest evidence is a sandbox run in a fresh checkout. Reading a script supports level 1 at most.</li>
        </ul>
      </div>
    </details>
    <h3>Try it: score your static gates</h3>
    <div class="prose">
      <p>
        In your own repository, score pillar 2 and pick one gap to fix.
      </p>
      <ol>
        <li>Find the command running all static checks (types and lint).</li>
        <li>Run it on clean <code>main</code>. Note commit, duration, and result.</li>
        <li>Check that CI runs the same command, and count suppressions.</li>
        <li>Compare with pillar 2's audit check and Figure 4. Take the highest verified level.</li>
      </ol>
      <p>
        Write one gap and its fix, such as making an optional CI check required
        (enforced, because it blocks merge).
      </p>
    </div>
    <h3>Choose the full audit's modes</h3>
    <div class="prose">
      <p>
        The skill runs every mode that applies. Guidance repositories like
        Filip Stack need both below. New-project setup is under
        <a href="#where-to-start">Where to start</a>.
      </p>
    </div>
    <UiTabs v-model="mode" :items="modes" label="Audit mode" class="modes">
      <template #panel="{ value }">
        <div v-if="value === 'existing'" class="modes__panel">
            <p class="hint">Measure what is there before changing anything.</p>
            <p>
              Times fresh-worktree setup to a running app inside the sandbox,
              runs all gates on clean <code>main</code>, samples 20 test
              declarations and three recent features, and checks recurring
              human review findings.
            </p>
        </div>
        <div v-else class="modes__panel">
            <p class="hint">Check the instruction files, skills, and review gates.</p>
            <p>
              Measures what each host loads every session, classifies lines as
              durable or decaying and advisory or enforced, and flags text-only
              “always” or “never” rules. In Claude Code, <code>/context</code>
              shows what loaded.
            </p>
        </div>
      </template>
    </UiTabs>
    <h3 id="report">What the report contains</h3>
    <div class="prose">
      <p>
        The report lists each pillar's score, evidence, top gap, fix, and
        whether the fix is advisory or enforced. It ends with where the audit
        was hard to apply and lists each unverified check with what it needs.
      </p>
      <p>
        Fixes sort first by blast radius (how much damage a miss causes).
        Unenforced pillar 7 rules on secrets, protected paths, or irreversible
        actions come first, with anything hiding them such as truncated files.
        Durability and cost follow.
      </p>
    </div>
    <UiFigure class="lesson-figure" :number="5">
      <div class="order">
        <div v-for="group in fixOrder" :key="group.start">
          <span class="lesson-label">{{ group.label }}</span>
          <ol class="order__chips" :start="group.start">
            <li v-for="(number, index) in group.pillars" :key="number" class="order__chip">
              <span class="order__step"
                ><span class="fg-site-sr-only">Step </span
                >{{ group.start + index }}</span
              >
              {{ pillar(number).title }}
              <a
                class="pillar-tag"
                :href="`#${pillar(number).reference.replace(/\.md$/, '')}`"
                >Pillar {{ number }}</a
              >
            </li>
          </ol>
        </div>
        <p class="order__scale" aria-hidden="true">
          <span>Most durable</span><span>Least durable</span>
        </p>
      </div>
      <template #caption>
        After blast radius, fixes follow durability.
      </template>
    </UiFigure>
  </section>

  <section aria-labelledby="worked-example">
    <h2 id="worked-example">Worked example: auditing this repository</h2>
    <div class="prose">
      <p>
        Filip Stack ships both code and guidance, so its audit ran both modes:
        existing repository for pillars 1, 2, 3, and 6, and engineering
        guidance for pillars 4, 5, 7, and 8.
      </p>
    </div>
    <UiAlert class="lesson-caveat">
      <p>
      This audit ran on 2026-11-01 at <code>bc1587d1</code> in the thread that
      wrote the skill, so it is not independent. CI results were unreadable
      from the sandbox, so scores rest on local runs or source inspection.
      </p>
    </UiAlert>
    <div class="prose">
      <p>
        A fresh <code>pnpm install --frozen-lockfile</code> failed inside
        Claude Code's sandbox: one dependency ships a <code>.env</code> file,
        and the sandbox blocks writes to <code>**/.env*</code>. It works on a
        workstation, so timing setup there would score an environment agents
        never get.
      </p>
      <p>
        Every pillar scored 1.
      </p>
    </div>
    <div class="lesson-table">
      <table class="scorecard">
        <caption class="fg-site-sr-only">Audit scores for Filip Stack, in fix order</caption>
        <thead>
          <tr>
            <th scope="col">Pillar, in fix order</th>
            <th scope="col">Top gap and fix</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in scorecard" :key="row.pillar">
            <th scope="row">
              <span>{{ row.name }}</span>
              <span class="pillar-tag">Pillar {{ row.pillar }}</span>
              <UiScore :score="1" />
            </th>
            <td>
              <p>{{ row.gap }}</p>
              <p class="scorecard__fix">
                <span>Fix:</span> {{ row.fix }}
                <UiBadge>{{ row.channel }}</UiBadge>
              </p>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td><strong>8 of 24</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="prose">
      <p>
        Five audit friction points led to skill updates: repositories can need
        both modes, pillar 6 now covers guidance repositories, setup must work
        in the sandbox, the two-question test covers repository facts only, and
        some checks need code-host API access.
      </p>
      <p>Fixes merged since:</p>
      <ul>
        <li>
          <a :href="`${repository}/pull/83`">#83</a> added the Guardrails
          plugin, whose hook enforces the no-AI-attribution and 1Password rules
          (pillar 7).
        </li>
        <li>
          <a :href="`${repository}/pull/79`">#79</a> added setup and
          single-test commands to <code>AGENTS.md</code> (pillars 3 and 6).
        </li>
        <li>
          <a :href="`${repository}/pull/82`">#82</a> added Fallow to
          <code>pnpm check</code> (pillars 1 and 2). Root scripts still lack a
          type check, keeping pillar 2 partial.
        </li>
      </ul>
      <p>
        An independent rerun on 2026-11-03 at <code>7c09fbed</code>, with
        borrowed dependencies, scored 10 of 24. Code shape and test gates
        reached 2. Fresh setup still failed, keeping pillar 6 at 1.
      </p>
    </div>
  </section>

  <section aria-labelledby="where-to-start">
    <h2 id="where-to-start">Where to start</h2>
    <div class="prose">
      <p>
        For an existing repository, install the skill below and ask: “Audit
        this repository for agent readiness.”
      </p>
    </div>
    <UiCodeBlock
      :code="install"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
    <h3 id="new-project">New project</h3>
    <div class="prose">
      <p>
        Add the gates before you write code, while they cost the least. In
        this order:
      </p>
    </div>
    <ol class="fg-site-steps">
      <li>Pillar 6: one command for setup, run, and teardown, with seed data and a health check. Verify inside the sandbox.</li>
      <li>Pillars 2 and 3: strict types, lint, dead-code and boundary checks, and a single-file test command behind one <code>check</code> command required by CI.</li>
      <li>Pillar 7: deny rules and sandbox limits for every “never” rule.</li>
      <li>Pillar 4: a short <code>AGENTS.md</code> with those commands. Add a rule only after correcting the agent twice.</li>
      <li>Pillars 1 and 5: grow with the code. Record decisions as you make them and add review checks as risk appears.</li>
    </ol>
  </section>

  <section aria-labelledby="maintenance">
    <h2 id="maintenance">Keeping guidance current</h2>
    <div class="prose">
      <p>Agent guidance, including this page, goes stale in two ways.</p>
    </div>
    <dl class="fg-site-definitions">
      <dt>Drift</dt>
      <dd>A vendor source changes, so a cited claim no longer matches.</dd>
      <dt>Decay</dt>
      <dd>A newer model follows an instruction by default, so it adds no value or hurts results.</dd>
    </dl>
    <div class="prose">
      <p>Review the guidance when any of these happens:</p>
      <ul>
        <li>A frontier model your agents use is released.</li>
        <li>A source you cite, or a vendor changelog you watch, changes.</li>
        <li>An audit score disagrees with how agents actually perform in that repository.</li>
        <li>A quarter passes with no review.</li>
      </ul>
      <p>
        The
        <a :href="`${referenceBase}${maintenanceFile}`">maintenance procedure</a>
        has the steps. Its core is the decay test: remove one section at a
        time, and delete it only when matched runs with and without it show no
        difference. Because it runs paid evaluations, set tasks and budget
        first. A monthly agent can recheck sources and open a PR.
      </p>
    </div>
  </section>

  <section aria-labelledby="next-steps">
    <h2 id="next-steps">Next steps</h2>
    <ul class="parts">
      <li>
        <a href="/filip-stack/skills/agent-ready-environments/">Skill page</a>
        <p>When to use the skill and what you get.</p>
      </li>
      <li>
        <a :href="skill.source">Skill source</a>
        <p>The full procedure, rubric, and sources the agent follows.</p>
      </li>
      <li>
        <a :href="`${referenceBase}${maintenanceFile}`">Maintenance procedure</a>
        <p>The review triggers and steps, including the decay test.</p>
      </li>
    </ul>
  </section>

  <section aria-labelledby="further-reading">
    <h2 id="further-reading">Further reading</h2>
    <div class="prose">
      <p>
        The vendor guidance behind this skill, last verified between 2026-11-01
        and 2026-11-17.
      </p>
    </div>
    <ul class="further-reading">
      <li v-for="source in sources" :key="source.href">
        <a :href="source.href">{{ source.title }}</a>
        <span v-if="'note' in source" class="further-reading__note">{{ source.note }}</span>
      </li>
    </ul>
    <h3>Notes</h3>
    <ul class="further-reading">
      <li>The score ladder, the fix order, and the durability ranking are the skill's own. The vendor guides do not rank the pillars.</li>
      <li>The test layers in pillar 3 come from field practice, not vendor guidance.</li>
      <li>An earlier draft of the worked example scored 12 of 24 under a looser rubric. The repository had not changed.</li>
    </ul>
  </section>

</template>

<style scoped>
.lesson-label { display: block; color: var(--color-muted); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.lesson-contents { display: grid; gap: var(--space-2); padding-top: var(--space-4); border-top: 1px solid var(--color-border-subtle); }
.lesson-contents ol { max-width: none; margin: 0; padding-inline-start: 1.5em; columns: 2 15rem; column-gap: var(--space-8); font-size: var(--text-md); }
.lesson-contents li { padding-block: 2px; break-inside: avoid; }
.lesson-contents li::marker { color: var(--color-muted); font-variant-numeric: tabular-nums; }
.lesson-contents a { text-decoration: none; }
.lesson-contents a:hover { text-decoration: underline; }

.jobs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); margin: 0; }
.jobs > div { display: grid; gap: var(--space-1); align-content: start; padding-top: var(--space-3); border-top: 1px solid var(--color-border-subtle); }
.jobs dt { font-weight: var(--weight-semibold); }
.jobs dd { margin: 0; color: var(--color-muted); font-size: var(--text-md); }

/* UiFigure sets no outer margin; the lesson spaces its figures here. */
.lesson-figure { margin-block: var(--space-4); }

/* Figure 2: four nodes joined by arrows; the enforced node sits on the boundary. */
.channels, .ladder, .pillar-map, .order__chips, .order p { max-width: none; }
#report { margin-top: var(--space-6); }
.channels { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-6); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); }
.channels > li { position: relative; display: grid; gap: var(--space-1); align-content: start; padding: var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-panel); background: var(--color-surface-raised); }
.channels > li + li::before { content: '→'; position: absolute; top: 50%; left: calc(-1 * var(--space-6)); width: var(--space-6); color: var(--color-muted); text-align: center; translate: 0 -50%; }
.channels__advisory { border-style: dashed !important; }
.channels__enforced { border-color: var(--color-border) !important; }

/* Figure 3: each level is one step higher than the one before. */
.ladder { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; gap: var(--space-2); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); }
.ladder > li { display: grid; gap: var(--space-1); align-content: start; padding: var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-panel); background: var(--color-surface-raised); }
.ladder > li:nth-child(1) { min-height: 7rem; }
.ladder > li:nth-child(2) { min-height: 9rem; }
.ladder > li:nth-child(3) { min-height: 11rem; }
.ladder > li:nth-child(4) { min-height: 13rem; }
.ladder > li > span:last-child { color: var(--color-muted); }
.ladder__score { font-size: var(--text-xl); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; }

.modes__panel { display: grid; gap: var(--space-3); padding-top: var(--space-4); }
/* The hand-audit rules: the same disclosure look as each pillar's list. */
.lesson-disclosure { max-width: var(--measure); }
.lesson-disclosure summary { width: fit-content; padding-block: var(--space-2); color: var(--color-text); font-size: var(--text-md); font-weight: var(--weight-medium); cursor: pointer; }
.lesson-disclosure summary::marker { color: var(--color-muted); }
.lesson-disclosure[open] summary { margin-bottom: var(--space-2); }
.fg-site-steps { max-width: var(--measure); font-size: var(--text-md); }

/* Figure 3: the pillars grouped by job. */
.pillar-map { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: var(--space-4); margin: 0; padding: 0; list-style: none; }
.pillar-map > li { display: grid; gap: var(--space-2); align-content: start; }
.pillar-map ul { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.pillar-map a { display: grid; align-content: center; min-height: var(--control-touch); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-inline); background: var(--color-surface-raised); color: var(--color-text); font-size: var(--text-md); text-decoration: none; }
@media (hover: hover) { .pillar-map a:hover { border-color: var(--color-border); text-decoration: none; } }
/* Figures 3 and 5: the pillar number is a tag, not a position. */
.pillar-tag { display: block; width: fit-content; margin-top: var(--space-1); color: var(--color-muted); font-size: var(--text-xs); }
@media (hover: hover) { a.pillar-tag:hover { color: var(--color-text); } }

/* Figure 4: the fix order. */
.order { display: grid; gap: var(--space-2); font-size: var(--text-sm); }
.order > div { display: grid; gap: var(--space-2); }
.order > div + div { margin-top: var(--space-3); }
.order__chips { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.order__chip { display: block; padding: var(--space-2); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-panel); background: var(--color-surface-raised); line-height: var(--leading-tight); }
.order__step { display: block; font-size: var(--text-lg); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; }
.order__scale { display: flex; justify-content: space-between; margin-top: var(--space-4); padding-top: var(--space-1); border-top: 1px solid var(--color-border-subtle); color: var(--color-muted); font-size: var(--text-xs); }

.lesson-table { max-width: 100%; overflow-x: auto; font-size: var(--text-md); }
.lesson-table table { width: 100%; border-collapse: collapse; }
.lesson-table th { padding: 0 var(--space-4) var(--space-2) 0; color: var(--color-muted); font-size: var(--text-sm); font-weight: var(--weight-medium); text-align: start; vertical-align: top; }
.lesson-table td, .lesson-table tbody th, .lesson-table tfoot th { padding: var(--space-3) var(--space-4) var(--space-3) 0; border-top: 1px solid var(--color-border-subtle); color: var(--color-text); font-size: var(--text-md); vertical-align: top; }
.lesson-table tbody tr:last-child > * { border-bottom: 1px solid var(--color-border-subtle); }
.scorecard tbody th { width: 13rem; font-weight: var(--weight-medium); }
.scorecard tbody th > span:first-child { display: block; }
.scorecard .pillar-tag { margin-bottom: var(--space-1); font-weight: var(--weight-regular); }
.scorecard td p + p { margin-top: var(--space-1); }
.scorecard__fix { color: var(--color-muted); }
.scorecard__fix > span:first-child { color: var(--color-text); font-weight: var(--weight-medium); }
.lesson-caveat { max-width: var(--measure); font-size: var(--text-md); }

.further-reading { display: grid; gap: var(--space-2); max-width: var(--measure); font-size: var(--text-md); }
.further-reading__note { display: block; color: var(--color-muted); font-size: var(--text-sm); }

@media (max-width: 800px) {
  .jobs { grid-template-columns: minmax(0, 1fr); }
  .channels { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
  .channels > li + li::before { content: '↓'; top: calc(-1 * var(--space-5)); left: 50%; width: auto; height: var(--space-5); line-height: var(--space-5); translate: -50% 0; }
  .ladder { grid-template-columns: minmax(0, 1fr); }
  .ladder > li { min-height: 0 !important; margin-left: 0; }
  .ladder > li:nth-child(2) { margin-left: var(--space-4); }
  .ladder > li:nth-child(3) { margin-left: var(--space-8); }
  .ladder > li:nth-child(4) { margin-left: var(--space-12); }
  .order__chips { grid-template-columns: minmax(0, 1fr); }
  .order__scale { display: none; }
  .pillar-map { grid-template-columns: minmax(0, 1fr); }
  .scorecard tbody th { width: 9rem; }
}
</style>
