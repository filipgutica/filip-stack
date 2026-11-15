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
    gap: "The attribution rule was advisory only, and an injected session reminder contradicted it.",
    fix: "A hook that blocks attribution trailers, plus ask rules for merges and 1Password.",
    channel: "Enforced",
  },
  {
    pillar: 6,
    name: "Reproducible environment",
    gap: "A fresh worktree could not install dependencies inside the agent's sandbox.",
    fix: "Share installed dependencies into worktrees, or narrow the sandbox rule. Document setup in AGENTS.md. Add a site preview per PR.",
    channel: "Enforced and advisory",
  },
  {
    pillar: 3,
    name: "Test gates",
    gap: "No twenty-test sample, no single-test command in AGENTS.md, and an unverified flake rate.",
    fix: "Run the sample. Add node --test <file> to AGENTS.md.",
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
    fix: "Decide whether a reviewer triggered by risk is worth its cost.",
    channel: "Enforced",
  },
  {
    pillar: 1,
    name: "Code shape",
    gap: "Boundary checks passed, but no duplication tool ran.",
    fix: "Fallow, as for pillar 2.",
    channel: "Enforced",
  },
  {
    pillar: 8,
    name: "Guidance evaluated",
    gap: "The Workflow skills have baseline studies. The global guidance has none.",
    fix: "Run the decay test on the global guidance.",
    channel: "Advisory",
  },
  {
    pillar: 4,
    name: "Documentation",
    gap: "Not every documented command was run, and the global guidance was not decay-tested.",
    fix: "Prune it with the decay test.",
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
      An agent-ready environment lets a coding agent check its own work.
      Without one, the agent stops when the work looks done, and you become
      its test suite. You will learn what makes a repository checkable, score
      one area by hand, and see a full audit of this repository.
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
        A coding agent edits files, runs the checks it can, and stops when the
        work <em>looks</em> done. It observes through the repository's checks:
        tests and a type check let it find failures, and a running app with
        realistic data lets it look at the page.
      </p>
    </div>
    <UiFigure class="lesson-figure" :number="1">
      <CatchFigure />
      <template #caption>
        Who catches it? The same change, with and without four parts of an
        agent-ready environment. The scenario is illustrative.
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
          Give the agent what the repository cannot show, such as why not to
          copy an old helper, and the command that runs every check.
        </dd>
      </div>
      <div>
        <dt>Check</dt>
        <dd>
          Return pass or fail: a type checker, a test, or a health check after
          setup.
        </dd>
      </div>
      <div>
        <dt>Bound</dt>
        <dd>
          Limit what the agent can touch and name who approves the result. For
          example, deny access to <code>.env</code> files, or require a person
          to authorize a merge.
        </dd>
      </div>
    </dl>
    <div class="prose">
      <p>
        In Figure 1, the check command, tests, and seeded app do the check job,
        and the deny rule does the bound job. An instruction only tells: it cannot verify the
        result.
      </p>
    </div>
  </section>

  <section aria-labelledby="placement-advisory-or-enforced">
    <h2 id="placement-advisory-or-enforced">Advisory or enforced</h2>
    <div class="prose">
      <p>
        <strong>Advisory</strong> guidance is text: the prompt,
        <code>AGENTS.md</code> or <code>CLAUDE.md</code>, and skills. The agent
        may decide it does not apply. <strong>Enforced</strong> guidance, such
        as a hook or required CI, runs at a tool call, commit, or merge,
        whatever the agent decided.
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
          <span>Tool call, commit, or merge, or a block with a message</span>
        </li>
      </ol>
      <template #caption>
        Enforced checks run between the agent's decision and the action,
        whatever it decided.
      </template>
    </UiFigure>
    <div class="prose">
      <p>Pick the channel by the rule's exceptions.</p>
      <ul>
        <li>
          Enforce rules that have no exceptions. When documentation does not
          make the agent follow a rule, put it in code, as OpenAI's
          <a :href="sources.harnessEngineering.href">harness engineering article</a>
          describes.
        </li>
        <li>
          If the agent keeps missing an advisory line, enforce it when it has
          no exceptions, or shorten the file so the line is easy to find.
          Emphasis fixes neither.
        </li>
        <li>
          Keep preferences advisory. Hooks sometimes block valid actions and
          need maintenance, so a large enforced set suggests preferences
          leaked into it.
        </li>
        <li>
          Write error messages that say how to fix the failure.
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="durable-and-decaying-guidance">
    <h2 id="durable-and-decaying-guidance">Durable and decaying guidance</h2>
    <div class="prose">
      <p>
        Guidance that makes up for a model's weaknesses decays as models
        improve. Guidance that gives the model what it cannot get by itself
        lasts, so invest in it.
        <a :href="sources.claudeCodeBestPractices.href">Anthropic's Claude Code best practices</a>
        now include “What you can stop doing”.
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
        The skill ranks a reproducible environment (pillar 6) as the most
        durable investment, then static and test gates. Documentation loses
        value as models get better at reading code.
      </p>
    </div>
  </section>

  <section aria-labelledby="the-pillars">
    <h2 id="the-pillars">The eight pillars</h2>
    <div class="prose">
      <p>
        Each pillar has one job and an observable audit check. Its reference
        in the skill has the full criteria.
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
        Agents copy the patterns they find, including ones the team is
        replacing. With one pattern for each job, the nearest example is the
        right one.
      </p>
      <template #check>
        In three recent features, each decision, such as a validation rule or
        permission check, is made in one place. Duplication and boundary tools
        pass.
      </template>
      <template #good>
        <ul>
          <li>Each concept has one owning module that others call.</li>
          <li>A tool enforces dependency direction, such as dependency-cruiser, import-linter, Go <code>internal/</code> packages, or ArchUnit.</li>
          <li>Legacy areas are marked “do not copy”, ideally with a lint rule that bans the old import.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(2)"
      :reference-base="referenceBase"
    >
      <p>
        The command that runs the type check and linter is the most useful
        line in an instruction file. A <code>Stop</code> hook makes running it
        a condition of finishing.
      </p>
      <template #check>
        One command runs every static gate locally, and CI runs the same
        command. Clean <code>main</code> is green, and suppressions are counted.
      </template>
      <template #good>
        <ul>
          <li>Strict typing: TypeScript <code>strict</code>, mypy or Pyright strict, <code>go vet</code> with staticcheck, Clippy with warnings denied.</li>
          <li>Lint, dead code, unused dependencies, complexity, and duplication checks.</li>
          <li>Warnings fail the build, and each suppression carries a reason.</li>
          <li>Error messages say how to fix the problem.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(3)"
      :reference-base="referenceBase"
    >
      <p>
        Agents tend to call a feature done after unit tests or a
        <code>curl</code> call, and catch more bugs when they test end to end.
        A test that cannot fail gives false confidence.
      </p>
      <template #check>
        A single test file runs with one command. A sample of tests each maps
        to one contract and one credible regression.
      </template>
      <template #good>
        <ul>
          <li>Each layer owns a different risk: unit tests for pure logic, component tests for a public contract, integration tests for real boundaries, and a few end-to-end tests for user journeys.</li>
          <li>A regression test fails on the code before the fix.</li>
          <li>Mutation testing on critical modules proves the tests can fail.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(4)"
      :reference-base="referenceBase"
    >
      <p>
        Every always-loaded line costs attention on every task. For each line, ask: could the agent find this
        by reading the code, and would it actually look? If both answers are
        yes, delete the line. Keep verification commands anyway: they are the
        most useful lines. For global rules no repository can show, use the
        <a href="#maintenance">decay test</a>.
      </p>
      <template #check>
        Every always-loaded line passes the two-question test or the decay
        test, and every documented command runs.
      </template>
      <template #good>
        <ul>
          <li>The always-loaded file has the commands to install, run one test, typecheck, lint, and run the app, plus decisions the code does not show and anything corrected twice.</li>
          <li>Repeated procedures live in skills, which load only when needed.</li>
          <li>No layout descriptions: agents find the layout easily, and descriptions go stale.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(5)"
      :reference-base="referenceBase"
    >
      <p>
        A reviewer in a fresh context cannot be swayed by the author's
        reasoning. Asked to find problems, it always finds some, and fixing
        all of them adds needless code. Say in the prompt what to skip.
      </p>
      <template #check>
        Each review angle has a trigger, runs read-only in a fresh context, and
        has its findings verified before anyone fixes them.
      </template>
      <template #good>
        <ul>
          <li>Anything a tool can check is left to a gate (pillar 2).</li>
          <li>Every change is checked against its spec or ticket. Other angles, such as security or performance, run when the diff carries their risk.</li>
          <li>A person authorizes the merge, each time or in advance under pillar 7.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(6)"
      :reference-base="referenceBase"
    >
      <p>
        The agent needs a running app with data for the states it must
        inspect. A setup failure may not stop it:
        <a :href="sources.copilotEnvironment.href">GitHub's Copilot documentation</a>
        says it continues in a partial environment. End setup with a health
        check.
      </p>
      <template #check>
        Inside the agent's sandbox, one command starts a seeded, healthy app
        from a fresh worktree. Two worktrees run at once without collisions.
      </template>
      <template #good>
        <ul>
          <li>A deterministic seed covers the states that matter, such as empty, error, and each permission level, with no production personal data.</li>
          <li>The agent can observe the app through browser automation, logs, and traces.</li>
          <li>A repository that ships guidance instead of an app uses a throwaway host home where the guidance applies, and a harness that runs agents against it.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(7)"
      :reference-base="referenceBase"
    >
      <p>
        Before a run goes unattended, answer five questions: Does it know what
        done looks like? Can it check its own work? What may it touch? What
        stops it? Who signs off? Put rules that must never break in deny
        rules, hooks, or the sandbox: a model-based safety classifier can be
        wrong.
      </p>
      <template #check>
        Every “never” rule is a deny rule, hook, or sandbox limit. Unattended
        runs have turn or spend caps and a named sign-off on the result.
      </template>
      <template #good>
        <ul>
          <li>Deny rules for secrets and protected paths.</li>
          <li>Worktree or container isolation, and least-privilege tokens.</li>
          <li>A person authorizes merges, deploys, and anything irreversible, each time or in advance with a stated scope, an enforced boundary, a run cap, and a named sign-off. Running without a repeated approval prompt is not a gap.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(8)"
      :reference-base="referenceBase"
    >
      <p>
        <a :href="sources.skillAuthoring.href">Anthropic's skill authoring guide</a>
        says to measure the agent without guidance first, then write the
        minimum guidance that fixes the failures you saw. Test with every
        model the guidance targets: one model may need an instruction that
        another does not.
      </p>
      <template #check>
        Each instruction file or skill has evidence that it changes behavior
        against a no-guidance baseline.
      </template>
      <template #good>
        <ul>
          <li>Evaluations compare guidance with no guidance on matched tasks, model, and harness.</li>
          <li>Routing evaluations check that skill descriptions trigger when they should.</li>
          <li>Instructions the current model already follows are removed.</li>
        </ul>
      </template>
    </PillarSection>
  </section>

  <section aria-labelledby="audit-procedure">
    <h2 id="audit-procedure">Audit a repository</h2>
    <div class="prose">
      <p>
        An audit turns the pillar checks into scores and a fix order.
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
          <span>A documented policy, a script, or a partly working mechanism, with some level 2 criterion unmet or unverified.</span>
        </li>
        <li>
          <span class="ladder__score">2</span>
          <strong>Runnable</strong>
          <span>The pillar's audit check passes on runnable evidence. Only pillar 6 requires a fresh checkout.</span>
        </li>
        <li>
          <span class="ladder__score">3</span>
          <strong>Enforced and measured</strong>
          <span>That check also blocks the action it guards, and its results are tracked over at least 20 runs or 30 days.</span>
        </li>
      </ol>
      <template #caption>
        Each level builds on the one below. A required check that blocks
        merge, or a hook that blocks a tool call, is enforced. Optional CI
        stays at level 2.
      </template>
    </UiFigure>
    <div class="prose">
      <p>
        Give each pillar the highest score its verified evidence fully meets.
        Checks you could not run go under Unverified and cannot raise the
        score.
      </p>
    </div>
    <details class="lesson-disclosure">
      <summary>Scoring rules for auditing without the skill</summary>
      <div class="prose">
        <p>
          The skill's <a :href="skill.source">SKILL.md</a> has the full rubric,
          and each pillar's reference has the detailed checks. Three rules
          matter most by hand:
        </p>
        <ul>
          <li>When a pillar covers several artifacts, such as instruction files, score the weakest one.</li>
          <li>Mark a pillar N/A when it does not apply, with a one-line reason, and leave it out of the total.</li>
          <li>The best evidence is a run in a fresh checkout inside the agent's sandbox. Reading a script without running it supports level 1 at most.</li>
        </ul>
      </div>
    </details>
    <h3>Try it: score your static gates</h3>
    <div class="prose">
      <p>
        In a repository you work in, score pillar 2 and find one gap to fix.
      </p>
      <ol>
        <li>Find the command that runs all static gates, such as types and lint.</li>
        <li>Run it on clean <code>main</code>. Note the commit, duration, and result.</li>
        <li>Check that CI runs the same command, and count the suppressions.</li>
        <li>Compare your findings with pillar 2's audit check and Figure 4. Take the highest level you verified.</li>
      </ol>
      <p>
        Then write one gap and its fix, such as making an optional check
        required: an enforced fix, because it blocks merge.
      </p>
    </div>
    <h3>Choose the full audit's modes</h3>
    <div class="prose">
      <p>
        The skill runs every audit mode that applies. A repository that ships
        guidance, such as Filip Stack, needs both modes below. The new-project
        mode is under <a href="#where-to-start">Where to start</a>.
      </p>
    </div>
    <UiTabs v-model="mode" :items="modes" label="Audit mode" class="modes">
      <template #panel="{ value }">
        <div v-if="value === 'existing'" class="modes__panel">
            <p class="hint">Measure what is there before you change anything.</p>
            <p>
              The skill times setup from a fresh worktree to a running app
              inside the agent's sandbox, runs every gate on clean
              <code>main</code>, samples tests and recent features, and looks
              for recurring human review comments.
            </p>
        </div>
        <div v-else class="modes__panel">
            <p class="hint">Check the instruction files, skills, and review gates.</p>
            <p>
              The skill measures what each host loads every session, sorts each
              instruction as durable or decaying and advisory or enforced, and
              flags “always” or “never” rules that are only advisory. In Claude
              Code, <code>/context</code> shows what loaded.
            </p>
        </div>
      </template>
    </UiTabs>
    <h3 id="report">What the report contains</h3>
    <div class="prose">
      <p>
        The report has one row per pillar: score, evidence, top gap, fix, and
        channel. It ends with where the skill was hard to apply, and the
        unverified checks with what they need.
      </p>
      <p>
        Fixes are ordered first by blast radius, meaning how much damage a
        miss can do. Unenforced pillar 7 rules about secrets, protected paths,
        or irreversible actions come first, with anything that hides them,
        such as instructions cut off by a size limit. Then come durability and
        cost.
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
        After blast radius, fixes follow the durability ranking.
      </template>
    </UiFigure>
  </section>

  <section aria-labelledby="worked-example">
    <h2 id="worked-example">Worked example: auditing this repository</h2>
    <div class="prose">
      <p>
        Filip Stack is a repository and a body of guidance, so its audit ran
        both modes: existing repository for pillars 1, 2, 3, and 6, and
        engineering guidance for pillars 4, 5, 7, and 8.
      </p>
    </div>
    <UiAlert class="lesson-caveat">
      <p>
      The audit ran on 2026-11-01 at commit <code>bc1587d1</code>, in the
      agent thread that wrote the skill, so it is not independent. No CI
      results were readable from the sandbox, so every score rests on a local
      run or source inspection.
      </p>
    </UiAlert>
    <div class="prose">
      <p>
        A fresh <code>pnpm install --frozen-lockfile</code> failed inside
        Claude Code's sandbox: one dependency ships a <code>.env</code> file,
        and the sandbox denies writes to <code>**/.env*</code>. The same
        install works on a workstation, so timing setup there would have
        scored an environment the agent never gets.
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
        Five places where the skill was hard to apply became skill changes:
        a repository can need both modes, pillar 6 needed a meaning for
        guidance repositories, setup must succeed inside the sandbox, the
        two-question test covers only repository facts, and some checks need
        forge access.
      </p>
      <p>Fixes merged since:</p>
      <ul>
        <li>
          <a :href="`${repository}/pull/83`">#83</a> added the Guardrails
          plugin, whose hook enforces the attribution and 1Password rules
          (pillar 7).
        </li>
        <li>
          <a :href="`${repository}/pull/79`">#79</a> put the setup and
          single-test commands in <code>AGENTS.md</code> (pillars 3 and 6).
        </li>
        <li>
          <a :href="`${repository}/pull/82`">#82</a> added Fallow to
          <code>pnpm check</code> (pillars 1 and 2). Root scripts still have no
          type check, so pillar 2 remains partial.
        </li>
      </ul>
      <p>
        An independent rerun on 2026-11-03 at <code>7c09fbed</code>, with
        borrowed dependencies, scored 10 of 24. Code shape and test gates rose
        to 2. Fresh setup still failed in the sandbox, so pillar 6 stayed at 1.
      </p>
    </div>
  </section>

  <section aria-labelledby="where-to-start">
    <h2 id="where-to-start">Where to start</h2>
    <div class="prose">
      <p>
        For an existing repository, install the companion skill and ask your
        agent: “Audit this repository for agent readiness.”
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
      <li>Pillar 6: one command for setup, run, and teardown, with a seed script and a health check. Verify it inside the agent's sandbox.</li>
      <li>Pillars 2 and 3: strict types, lint, dead-code and boundary tools, and a single-file test command, all run by one <code>check</code> command that CI requires.</li>
      <li>Pillar 7: deny rules and sandbox limits for every “never” rule.</li>
      <li>Pillar 4: a short <code>AGENTS.md</code> with those commands. Add a line only after you have corrected the agent twice.</li>
      <li>Pillars 1 and 5 grow with the code. Record each decision when you make it, and add review angles as risk appears.</li>
    </ol>
  </section>

  <section aria-labelledby="maintenance">
    <h2 id="maintenance">Keeping guidance current</h2>
    <div class="prose">
      <p>Guidance about agents, this lesson included, goes stale in two ways.</p>
    </div>
    <dl class="fg-site-definitions">
      <dt>Drift</dt>
      <dd>A source changes, so a cited claim no longer matches what the vendor says.</dd>
      <dt>Decay</dt>
      <dd>A new model follows an instruction by default, so the instruction adds no value or does harm.</dd>
    </dl>
    <div class="prose">
      <p>Review the guidance when any of these happens:</p>
      <ul>
        <li>A frontier model your agents use is released.</li>
        <li>A source you cite, or a vendor changelog you watch, changes.</li>
        <li>An audit score does not match how agents actually perform in that repository.</li>
        <li>A quarter passes with no review.</li>
      </ul>
      <p>
        The skill's
        <a :href="`${referenceBase}${maintenanceFile}`">maintenance procedure</a>
        has the steps. Its core is the decay test: remove one section at a
        time, and delete it only when runs without it do as well. The test
        runs paid evaluations, so set the tasks and budget first. A monthly
        scheduled agent can recheck sources and open a pull request.
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
        The vendor guidance behind the skill, last checked between 2026-11-01
        and 2026-11-03.
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
.pillar-map a { display: grid; align-content: center; min-height: var(--control-lg); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-inline); background: var(--color-surface-raised); color: var(--color-text); font-size: var(--text-md); text-decoration: none; }
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
