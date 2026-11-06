<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiAlert, UiBadge, UiCodeBlock, UiFigure, UiScore, UiTabs } from "@filipgutica/ui";
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
    gap: "The rule against AI attribution in commits was advisory only, and a reminder the harness injects every session contradicted it.",
    fix: "A hook that blocks attribution trailers, plus ask rules for merges and 1Password.",
    channel: "Enforced",
  },
  {
    pillar: 6,
    name: "Reproducible environment",
    gap: "A fresh agent worktree could not install dependencies inside the agent's sandbox.",
    fix: "Share installed dependencies into worktrees, or narrow the sandbox rule. Put the fresh-worktree command in AGENTS.md. Add a site preview per PR.",
    channel: "Enforced and advisory",
  },
  {
    pillar: 3,
    name: "Test gates",
    gap: "No twenty-test sample, no single-test command in AGENTS.md, and the flake rate was unverified.",
    fix: "Run the sample. Add node --test <file> to AGENTS.md.",
    channel: "Advisory",
  },
  {
    pillar: 2,
    name: "Static gates",
    gap: "About 5,700 lines of root scripts and tests had no static check.",
    fix: "Add a type check or Fallow to pnpm check.",
    channel: "Enforced",
  },
  {
    pillar: 5,
    name: "Review gates",
    gap: "No configuration showed a read-only, fresh-context reviewer running on pull requests.",
    fix: "Decide whether a reviewer triggered by risk is worth its cost.",
    channel: "Enforced",
  },
  {
    pillar: 1,
    name: "Code shape",
    gap: "Boundary checks passed, but there was no duplication tool, so level 2 was not met.",
    fix: "Fallow, the same fix as pillar 2.",
    channel: "Enforced",
  },
  {
    pillar: 8,
    name: "Guidance evaluated",
    gap: "The Workflow skills have baseline studies. The global guidance loaded on every task has none.",
    fix: "Run the decay test on the global guidance.",
    channel: "Advisory",
  },
  {
    pillar: 4,
    name: "Documentation",
    gap: "Not every documented command was run, and the always-loaded global guidance was not decay-tested.",
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
    <h1 id="agent-ready-environments">Agent-ready environments</h1>
    <p class="lede">
      An agent-ready environment lets a coding agent check its own work in
      the repository. Without one, the agent stops when its work looks done,
      you find the problems in review, and you become its test suite. This
      lesson is for engineers who want to understand what makes a repository
      checkable and learn to audit their own. You will score one pillar by
      hand before using the companion skill for a full audit.
    </p>
    <p>
      <a href="#where-to-start">Where to start</a> has the audit skill's
      install command and the first steps for a new project.
    </p>
    <dl class="fg-site-facts">
      <div>
        <dt>Reading time</dt>
        <dd>About 20 minutes</dd>
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
        When you ask a coding agent for a feature, it edits files and runs
        the checks it can. It stops when the work <em>looks</em> done.
        It cannot judge behavior it cannot observe.
      </p>
      <p>
        The repository's checks let the agent test whether the work is done.
        With a type-check command and tests that cover the behavior, the agent
        can find and fix failures. With a running app and realistic data, it
        can also inspect the page.
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
        An agent-ready environment has eight areas, called pillars. Each
        pillar does one of three jobs.
      </p>
    </div>
    <dl class="jobs">
      <div>
        <dt>Tell</dt>
        <dd>
          Give the agent information it cannot see in the repository, such as
          why it must not copy an old helper. Also give it the command that
          runs every check.
        </dd>
      </div>
      <div>
        <dt>Check</dt>
        <dd>
          Return a pass or fail result through a type checker, a test, or a
          health check after setup.
        </dd>
      </div>
      <div>
        <dt>Bound</dt>
        <dd>
          Limit what the agent can access or change, and name who approves
          the result. For example, deny access to <code>.env</code> files or
          require a person's authorization to merge.
        </dd>
      </div>
    </dl>
    <div class="prose">
      <p>
        In Figure 1, the check command, tests, and seeded app check the work.
        The deny rule limits the agent's actions. None of these four does the
        tell job. Instructions guide the agent's work but cannot verify the
        result.
      </p>
    </div>
  </section>

  <section aria-labelledby="placement-advisory-or-enforced">
    <h2 id="placement-advisory-or-enforced">Advisory or enforced</h2>
    <div class="prose">
      <p>
        A rule reaches the agent on one of two channels. <strong>Advisory</strong>
        guidance is text in the prompt, <code>AGENTS.md</code> or
        <code>CLAUDE.md</code>, and skills. The agent reads it and may decide
        it does not apply. <strong>Enforced</strong> guidance uses hooks,
        deny rules, the sandbox, the type checker, linters, or required CI
        checks. Each mechanism runs at an action boundary, such as a tool
        call, commit, or merge, regardless of the agent's decision.
      </p>
    </div>
    <UiFigure class="lesson-figure" :number="2">
      <ol class="flow" aria-label="How a rule reaches an action">
        <li class="flow__advisory">
          <span class="lesson-label">Advisory</span>
          <span>Prompt, <code>AGENTS.md</code>, skills</span>
        </li>
        <li>
          <span class="lesson-label">The agent</span>
          <span>Weighs the guidance and decides what to do</span>
        </li>
        <li class="flow__enforced">
          <span class="lesson-label">Enforced, at the boundary</span>
          <span>Hooks, deny rules, sandbox, type checker, required CI</span>
        </li>
        <li>
          <span class="lesson-label">The action</span>
          <span>Tool call, commit, or merge, or a block with a message</span>
        </li>
      </ol>
      <template #caption>
        The agent can disregard advisory guidance. Enforced checks run
        between its decision and the action, regardless of that decision.
      </template>
    </UiFigure>
    <div class="prose">
      <p>Put each rule on the channel that matches its exceptions.</p>
      <ul>
        <li>
          Enforce rules that have no exceptions. When documentation does not
          make the agent follow a rule, implement it in code, as OpenAI's
          <a :href="sources.harnessEngineering.href">harness engineering article</a>
          describes.
        </li>
        <li>
          When the agent repeatedly misses an advisory line, check for two
          causes. If the rule has no exceptions, enforce it with a hook or
          deny rule. If the file's length makes the line hard to find, shorten
          the file. Emphasis fixes neither cause.
        </li>
        <li>
          Keep preferences advisory. A large enforced set is a sign that
          preferences have leaked into it. Hooks sometimes block valid
          actions, and someone must maintain them.
        </li>
        <li>
          Write error messages that tell the agent how to fix the failure,
          so it can repair its own work.
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="durable-and-decaying-guidance">
    <h2 id="durable-and-decaying-guidance">Durable and decaying guidance</h2>
    <div class="prose">
      <p>
        Some guidance compensates for model weaknesses. Other guidance
        provides information or tools the model cannot get by itself. Vendors
        now separate the two:
        <a :href="sources.claudeCodeBestPractices.href">Anthropic's Claude Code best practices</a>
        include “What you can stop doing”. The first kind is decaying
        guidance: it loses value as models improve. The second kind is
        durable guidance. Invest in that kind.
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
        durable investment. Static and test gates come next because they
        make the work checkable. Documentation loses value as models get
        better at reading code.
      </p>
    </div>
  </section>

  <section aria-labelledby="the-pillars">
    <h2 id="the-pillars">The eight pillars</h2>
    <div class="prose">
      <p>
        You can audit each pillar on its own. Each has a job (tell, check,
        or bound) and an observable audit check.
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
        The eight pillars, grouped by the job each one does. Select a pillar
        to jump to it.
      </template>
    </UiFigure>

    <PillarSection
      v-bind="pillar(1)"
      :reference-base="referenceBase"
    >
      <p>
        Agents learn conventions from the code and copy the patterns they
        find, including ones the team is replacing. With one pattern for each
        job, the nearest example is the right one to copy.
      </p>
      <template #check>
        In three recent features, each decision is made in one place.
        Decisions include validation rules, permission checks, and state
        transitions. Duplication and boundary tools pass.
      </template>
      <template #good>
        <ul>
          <li>Each concept has one owning module. Other modules call it instead of implementing the same concept again.</li>
          <li>Dependency direction is declared and enforced, for example with ESLint boundary rules, dependency-cruiser, or Fallow in TypeScript, import-linter in Python, <code>internal/</code> packages in Go, or ArchUnit on the JVM.</li>
          <li>Data enters at one validated boundary and flows one way through named layers.</li>
          <li>Mark legacy areas “do not copy”. Where possible, enforce this with a lint rule that bans the old import.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(2)"
      :reference-base="referenceBase"
    >
      <p>
        The agent can read a build's exit code and a linter's results.
        The command that runs these checks is the most useful line in an
        instruction file. A <code>Stop</code> hook makes running the command
        a condition of finishing instead of a request. Codex guidance also
        asks for completion criteria and the relevant lint, format, and type
        checks.
      </p>
      <template #check>
        One command runs every static gate locally, and CI runs the same
        command. Clean <code>main</code> is green, and suppressions are counted.
      </template>
      <template #good>
        <ul>
          <li>Strict typing: TypeScript <code>strict</code>, mypy or Pyright strict, <code>go vet</code> with staticcheck, Clippy with warnings denied.</li>
          <li>Lint, dead code and unused dependencies, complexity limits, and duplication checks.</li>
          <li>One <code>check</code> command runs locally and in CI with the same configuration. A changed-files mode keeps it fast.</li>
          <li>Warnings fail the build or do not exist.</li>
          <li>Each suppression carries a reason, and the total is tracked.</li>
          <li>Error messages say how to fix the problem.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(3)"
      :reference-base="referenceBase"
    >
      <p>
        Tests are the main pass-or-fail check. Agents tend to call a feature
        complete after unit tests or a <code>curl</code> call. They catch more
        bugs when they test end to end as a user would. The agent runs and
        trusts every test, so a test that cannot fail gives false confidence.
      </p>
      <template #check>
        A single test file runs with one command. A sample of tests each maps
        to one contract and one credible regression.
      </template>
      <template #good>
        <ul>
          <li>Each layer owns a different risk. Unit tests check pure logic. Component tests check one unit's public contract. Integration or contract tests check boundaries with real dependencies. A few end-to-end tests check user journeys.</li>
          <li>Each contract has one primary test at the strongest boundary that reaches it.</li>
          <li>A regression test fails on the code before the fix.</li>
          <li>Tests are fast and deterministic, and coverage is measured on changed lines.</li>
          <li>Mutation testing on critical modules proves the tests can fail.</li>
          <li>Review flags deleted tests and weakened assertions.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(4)"
      :reference-base="referenceBase"
    >
      <p>
        Instruction files load into every session, so each line uses the
        agent's attention on every task. Keep the file short and load
        task-specific detail only when needed. For each line, ask two questions:
      </p>
      <ol>
        <li>Could the agent find this by reading the code?</li>
        <li>Would it actually go and look?</li>
      </ol>
      <p>
        If both answers are yes, delete the line. Keep verification commands
        even though <code>package.json</code> contains them: they are the most
        useful lines. For global behavior rules that no repository can show,
        use the <a href="#maintenance">decay test</a>.
      </p>
      <template #check>
        Every always-loaded line passes the two-question test or the decay
        test, and every documented command runs.
      </template>
      <template #good>
        <ul>
          <li>In the file that always loads, keep commands for install, single test, typecheck, lint, and running the app. Describe misleading parts of the code, decisions the code does not show, and anything corrected twice.</li>
          <li>Repeated procedures live in skills, which load only when a task needs them.</li>
          <li>Decision records explain why. A glossary maps domain terms to code names where they differ.</li>
          <li>CI runs the documented commands and checks the links.</li>
          <li>No dated advice in the body. Version requirements that are still true stay.</li>
          <li>Leave out layout descriptions: agents can find the layout easily, and descriptions become outdated quickly. A short pointer to an unusual layout is fine.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(5)"
      :reference-base="referenceBase"
    >
      <p>
        A reviewer in a fresh context has not seen the author's reasoning,
        so that reasoning cannot influence its review. Read-only tools prevent
        edits. A reviewer asked to find problems always finds some. Fixing
        every finding adds abstraction layers and tests for impossible cases.
        State what the reviewer should skip in the review prompt.
      </p>
      <template #check>
        Each review angle has a trigger, runs read-only in a fresh context, and
        has its findings verified before anyone fixes them.
      </template>
      <template #good>
        <ul>
          <li>Leave anything a tool can check to a gate (pillar 2).</li>
          <li>On every change, check that the diff meets the spec or ticket.</li>
          <li>Run other review angles when the diff carries their risks. Check simplicity and reuse for a new abstraction or dependency. Check test value when tests change. Review security for authentication, input, secrets, or permissions. Review performance for hot paths and unbounded loops. Check coding standards for rules no linter can express.</li>
          <li>The reviewer gets the spec and the diff, not the author's reasoning.</li>
          <li>Each finding is checked against the code before anyone fixes it.</li>
          <li>A person authorizes the merge, either each time or in advance under the scoped authorization in pillar 7.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(6)"
      :reference-base="referenceBase"
    >
      <p>
        The agent needs a running app and data that covers the states it must
        inspect. A fresh worktree has no installed dependencies, and
        installing them by trial and error is slow and can fail. A setup
        failure may not stop the agent:
        <a :href="sources.copilotEnvironment.href">GitHub's Copilot documentation</a>
        says it continues in a partial environment. End setup with a health
        check to detect these failures.
      </p>
      <template #check>
        Inside the agent's sandbox, one command starts a seeded, healthy app
        from a fresh worktree. Two worktrees run at once without collisions.
      </template>
      <template #good>
        <ul>
          <li>One command starts a running, seeded app from a clean checkout, both in the agent's sandbox and on a workstation. Each worktree has isolated ports, databases, and profiles.</li>
          <li>Script both cold setup (from nothing) and warm setup (dependencies already present). End setup with a health check that fails loudly.</li>
          <li>A deterministic seed, versioned with the schema, covers the states that matter: empty, error, large, each permission level, each locale. It contains no production personal data.</li>
          <li>The agent can observe the app: browser automation, logs, metrics, and traces from the command line.</li>
          <li>Provide one teardown command and a preview environment for human reviewers on each pull request.</li>
          <li>The recipe lives in a script or a project skill, not a README paragraph.</li>
          <li>For a repository that ships guidance instead of an app, use a throwaway host home where the guidance applies. Add a harness that runs agents against it.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(7)"
      :reference-base="referenceBase"
    >
      <p>
        Before a run goes unattended, answer five questions:
      </p>
      <ol>
        <li>Does it know what done looks like?</li>
        <li>Can it check its own work?</li>
        <li>What may it touch?</li>
        <li>What stops it?</li>
        <li>Where does the result go, and who signs off?</li>
      </ol>
      <p>
        Rules that must never be broken belong in deny rules, hooks, or the
        sandbox. A model-based safety classifier makes a judgment call, and it
        can be wrong.
      </p>
      <template #check>
        Every “never” rule is a deny rule, hook, or sandbox limit. Unattended
        runs have turn or spend caps and a named sign-off on the result.
      </template>
      <template #good>
        <ul>
          <li>Deny rules for secrets and protected paths.</li>
          <li>Worktree or container isolation, and least-privilege tokens.</li>
          <li>Turn or spend caps on unattended runs.</li>
          <li>A person authorizes merges, deploys, and anything irreversible. They can authorize each action or give advance authorization with a stated scope, an enforced boundary, a run cap, and a named sign-off on the result. Missing authorization is a gap. Running without a repeated approval prompt is not a gap.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(8)"
      :reference-base="referenceBase"
    >
      <p>
        <a :href="sources.skillAuthoring.href">Anthropic's skill authoring guide</a>
        recommends measuring the agent without guidance first. Then write the
        minimum guidance that addresses the failures you observed. Compare
        each revision with that baseline. Test with every model the guidance
        targets: an instruction one model needs may be redundant for another.
        Guidance that compensated for older models can become unnecessary.
      </p>
      <template #check>
        Each instruction file or skill has evidence that it changes behavior
        against a no-guidance baseline.
      </template>
      <template #good>
        <ul>
          <li>Evaluations compare guidance with no guidance on matched tasks, model, and harness.</li>
          <li>Routing evaluations check that skill descriptions trigger when they should.</li>
          <li>Periodically remove instructions the current model already follows by default.</li>
        </ul>
      </template>
    </PillarSection>
  </section>

  <section aria-labelledby="audit-procedure">
    <h2 id="audit-procedure">Audit a repository</h2>
    <div class="prose">
      <p>
        An audit turns the pillar checks into a score and a fix order. Learn
        the scoring rules first, then try one pillar in your own repository.
        The companion skill uses the same rubric for a full audit.
      </p>
    </div>
    <h3 id="scoring">How a pillar is scored</h3>
    <div class="prose">
      <p>
        Each pillar scores from 0 to 3. Higher scores need stronger evidence.
      </p>
    </div>
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
        The score ladder. A required check that blocks merge, or a hook that
        blocks a tool call, is enforced. Optional CI that fails loudly but does
        not block merge stays at level 2.
      </template>
    </UiFigure>
    <div class="prose">
      <p>
        Give each pillar the highest score for which the verified evidence
        meets every requirement. List unverified checks under Unverified.
        They cannot raise the score.
      </p>
    </div>
    <details class="lesson-disclosure">
      <summary>Scoring rules for auditing without the skill</summary>
      <div class="prose">
        <p>
          The skill applies these rules for you. Its
          <a :href="skill.source">SKILL.md</a> holds the full rubric, and each
          pillar's reference file has its detailed checks.
        </p>
        <ul>
          <li>For levels 2 and 3, the pillar must pass its audit check. Use the detailed reference checks to identify the top gap. They affect the score only where the reference says so.</li>
          <li>When a pillar covers several artifacts, such as instruction files, score the weakest applicable artifact. If the audit check needs a missing artifact, the pillar stays below level 2. The missing artifact alone does not require a score of 0.</li>
          <li>Mark a pillar N/A when it does not apply. Give a one-line reason and exclude it from the total. When only part applies, score that part and name the checks you omitted.</li>
          <li>For pillar 7, count a rule as enforced when the host or forge reports it active. Examples include a ruleset read with <code>gh api</code> or the host's effective deny rules. A rule stated only in prose is level 1.</li>
          <li>Score a failed fresh setup once, in pillar 6. Other pillars can reach level 2 using CI results for the exact commit audited. They can also use a local run with dependencies supplied another way, labelled as such.</li>
          <li>Required checks, branch rules, and review history need read access to the forge API, such as <code>gh api</code>. Without that access, mark them unverified.</li>
        </ul>
        <p>Evidence, from strongest to weakest:</p>
        <ol>
          <li>A local run in a fresh checkout, inside the agent's sandbox. Record the sandbox configuration, so a failure can be traced to the repository or to the auditor's machine.</li>
          <li>CI results on the exact commit audited.</li>
          <li>CI results on current <code>main</code>, labelled as a different commit.</li>
          <li>Source inspection: the script exists and reads correctly. For anything runnable, this supports level 1 at most.</li>
        </ol>
      </div>
    </details>
    <h3>Try it: score your static gates</h3>
    <div class="prose">
      <p>
        Use one repository you work in. Your result will be a score for
        pillar 2, the evidence behind it, and one gap to fix.
      </p>
      <ol>
        <li>Find the command that runs all static gates. Check the instruction file and the scripts it points to.</li>
        <li>Run it on clean <code>main</code>. Record the commit, command, duration, and result.</li>
        <li>Check that CI runs the same command with the same configuration. Count suppressions by kind: inline directives, disabled rules, and allowlist entries.</li>
        <li>Compare your evidence with pillar 2's audit check. Choose the highest score whose requirements you have verified.</li>
      </ol>
      <p>
        With no verified evidence, score 0. A documented command or
        partly working gate scores 1 if a level 2 requirement remains unmet.
        Score 2 when one command runs every static gate locally and in CI,
        clean <code>main</code> is green, and suppressions are counted.
        Optional CI can support 2. For 3, the check must also block its action,
        and results must be tracked over at least 20 runs or 30 days.
      </p>
      <p>
        If you cannot read the CI results or required-check settings, list
        them under Unverified. They cannot raise your score. Write one top
        gap and a fix: for example, make an optional check required. Its
        channel is Enforced, because the proposed fix would block merge.
      </p>
    </div>
    <h3>Choose the full audit's modes</h3>
    <div class="prose">
      <p>
        An audit has three modes. Use every mode that applies. The
        new-project mode is under
        <a href="#where-to-start">Where to start</a>. A repository that ships
        guidance, such as Filip Stack, needs both the existing-repository and
        engineering-guidance modes.
      </p>
    </div>
    <UiTabs v-model="mode" :items="modes" label="Audit mode" class="modes">
      <template #panel="{ value }">
        <div v-if="value === 'existing'" class="modes__panel">
            <p class="hint">Measure what is there before you change anything.</p>
            <ol class="fg-site-steps">
              <li>In the agent's sandbox, measure the time from a fresh worktree to a seeded, running app. Record cold and warm setup separately, including each manual step.</li>
              <li>Run every gate on clean <code>main</code>. Record how long each takes and what fails.</li>
              <li>Count suppressions by kind.</li>
              <li>Check twenty sample tests and three recent features against pillars 1 and 3.</li>
              <li>Look for repeated comments in recent human reviews. Each may indicate a missing rule, test, or documented decision, or an incorrect review. Verify the cause.</li>
              <li>Score every pillar.</li>
            </ol>
        </div>
        <div v-else class="modes__panel">
            <p class="hint">Check the instruction files, skills, and review gates.</p>
            <ol class="fg-site-steps">
              <li>Measure what each host loads every session. File sizes alone do not show this. In Claude Code, <code>/context</code> shows what loaded, as the <a :href="sources.claudeCodeBestPractices.href">Claude Code best practices</a> describe.</li>
              <li>Classify each instruction as durable or decaying, and as advisory or enforced.</li>
              <li>List every “always” or “never” rule that is only advisory. Each one is in the wrong place, or it is a preference worded too strongly.</li>
              <li>Find lines that restate the layout, scripts, or config. Keep the verification commands.</li>
              <li>Find instructions that repeat the same meaning across files.</li>
              <li>Check that review gates sort their findings and push back on over-fixing.</li>
              <li>Ask for evaluation evidence. A written policy with no results scores 1. No policy scores 0.</li>
            </ol>
        </div>
      </template>
    </UiTabs>
    <h3 id="report">What the report contains</h3>
    <div class="prose">
      <p>The report has four parts, in this order:</p>
      <ol>
        <li>An Evidence section.</li>
        <li>
          One table row per pillar, with its score, evidence, top gap, fix,
          and channel. The channel column describes the proposed fix, not the
          current state.
        </li>
        <li>The places where the skill was hard to apply.</li>
        <li>Unverified checks and what you need to run them.</li>
      </ol>
      <p>
        Order fixes first by the potential damage from a failure. Start with
        unenforced pillar 7 rules about secrets, protected paths, or
        irreversible actions. Also prioritize defects that hide those rules,
        such as instructions cut off by a size limit. Then order by
        durability, then by cost.
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
        After prioritizing potential damage, use the durability ranking
        introduced earlier.
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
      The audit ran on 2026-11-01 at commit <code>bc1587d1</code>, in the same
      agent thread that wrote the skill, so it is not independent. No CI
      results were readable from the sandbox, so every score rests on a local
      run or on source inspection.
      </p>
    </UiAlert>
    <div class="prose">
      <p>
        A fresh
        <code>pnpm install --frozen-lockfile</code> failed after three seconds
        inside Claude Code's sandbox. One dependency ships a
        <code>.env</code> file in its package, and that machine's sandbox
        denies writes to <code>**/.env*</code>. On a workstation the same
        install works. Had the audit timed setup on a workstation, it would
        have scored pillar 6 against an environment the agent never gets.
      </p>
      <p>
        Every pillar scored 1. Each had something written down or partly
        working, and each missed at least one level 2 criterion.
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
        The audit also found five places where the skill was hard to apply.
        Each became a change to the skill:
      </p>
      <ul>
        <li>A repository can need both modes.</li>
        <li>Pillar 6 needed a meaning for guidance repositories.</li>
        <li>Setup has to succeed inside the agent's sandbox.</li>
        <li>The two-question test covers only repository facts.</li>
        <li>Some checks need forge access.</li>
      </ul>
      <p>Fixes merged since, in the report's order:</p>
      <ul>
        <li>
          <a :href="`${repository}/pull/83`">#83</a> added an optional
          guardrails plugin whose hook enforces the attribution and 1Password
          rules (pillar 7).
        </li>
        <li>
          <a :href="`${repository}/pull/79`">#79</a> put the fresh-worktree
          setup command and a single-test command in <code>AGENTS.md</code>
          (pillars 3 and 6).
        </li>
        <li>
          <a :href="`${repository}/pull/82`">#82</a> added Fallow to
          <code>pnpm check</code> for dead code, complexity, and duplication
          (pillars 1 and 2). Root scripts still have no type check, so pillar 2
          remains partial.
        </li>
      </ul>
      <p>
        An independent rerun on 2026-11-03 at <code>7c09fbed</code>, using
        borrowed dependencies, scored 10 of 24. Code shape and test gates rose
        to 2. Fresh setup still failed inside the sandbox, so pillar 6 stayed
        at 1.
      </p>
    </div>
  </section>

  <section aria-labelledby="where-to-start">
    <h2 id="where-to-start">Where to start</h2>
    <div class="prose">
      <p>
        For an existing repository, start with an audit. Install the companion
        skill, then ask your agent to audit the repository for agent
        readiness. <a href="#audit-procedure">Audit a repository</a> explains
        what it checks and what the report contains.
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
      <li>Pillar 6: provide one command for setup, run, and teardown. Include a seed script and a health check. Verify it inside the agent's sandbox.</li>
      <li>Pillars 2 and 3: add strict types, lint, dead-code and boundary tools, and a single-file test command. Run them through one <code>check</code> command that CI also runs and requires.</li>
      <li>Pillar 7: deny rules and sandbox limits for every “never” rule.</li>
      <li>Pillar 4: a short <code>AGENTS.md</code> with those commands. Add a line only after you have corrected the agent twice.</li>
      <li>Pillars 1 and 5 grow with the code. Record each decision when you make it. Add review angles as risk appears.</li>
    </ol>
  </section>

  <section aria-labelledby="maintenance">
    <h2 id="maintenance">Keeping guidance current</h2>
    <div class="prose">
      <p>
        Guidance about agents, this lesson included, goes out of date in two
        ways.
      </p>
    </div>
    <dl class="fg-site-definitions">
      <dt>Drift</dt>
      <dd>A source changes, so a cited claim no longer matches what the vendor says.</dd>
      <dt>Decay</dt>
      <dd>A new model follows an instruction by default, so the instruction adds no value or does more harm than good.</dd>
    </dl>
    <div class="prose">
      <p>
        Vendors retire advice as models improve. Pillar 8 applies to this
        guidance too. Test it with the models it targets. Add instructions
        only where you have observed a failure.
      </p>
      <p>Review the guidance when any of these happens:</p>
      <ul>
        <li>A frontier model that your agents use is released. Read its migration guide or release notes.</li>
        <li>A source you cite, or a vendor changelog you watch, changes.</li>
        <li>An audit result is disputed, or a score does not match how agents actually perform in that repository.</li>
        <li>A quarter passes with no review.</li>
      </ul>
      <p>
        The review steps are in the skill's
        <a :href="`${referenceBase}${maintenanceFile}`">maintenance procedure</a>.
        For the decay test, set the tasks and budget first. Compare runs
        with guidance against runs without it. Then test the effect of
        removing one section at a time. Delete a section only when its
        removal makes no difference.
      </p>
      <p>
        Each month, a scheduled agent can recheck sources, collect new
        guidance, and open a pull request with its findings. The remaining
        review steps need judgment and a person's approval. The decay test
        costs money because it runs paid evaluations.
      </p>
    </div>
  </section>

  <section aria-labelledby="next-steps">
    <h2 id="next-steps">Next steps</h2>
    <div class="prose">
      <p>
        The <code>agent-ready-environments</code> skill gives agents the
        procedure taught in this lesson. Its install command is under
        <a href="#where-to-start">Where to start</a>.
      </p>
    </div>
    <ul class="parts">
      <li>
        <a href="/filip-stack/skills/agent-ready-environments/">Skill page</a>
        <p>What the skill does, when to use it, and what you get.</p>
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
      <li>The test layers in pillar 3 come from field practice. The vendors do not prescribe them.</li>
      <li>An earlier draft of the worked example scored 12 of 24 under a looser rubric. The drop came from tightening the rubric, not from any change in the repository.</li>
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
.jobs > div { display: grid; gap: var(--space-1); align-content: start; padding-top: var(--space-3); border-top: 2px solid var(--color-accent); }
.jobs dt { font-weight: var(--weight-semibold); }
.jobs dd { margin: 0; color: var(--color-muted); font-size: var(--text-md); }

/* UiFigure sets no outer margin; the lesson spaces its figures here. */
.lesson-figure { margin-block: var(--space-4); }

/* Figure 2: four nodes joined by arrows; the enforced node sits on the boundary. */
.flow, .ladder, .pillar-map, .order__chips, .order p { max-width: none; }
#report { margin-top: var(--space-6); }
.flow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-6); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); }
.flow > li { position: relative; display: grid; gap: var(--space-1); align-content: start; padding: var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); }
.flow > li + li::before { content: '→'; position: absolute; top: 50%; left: calc(-1 * var(--space-6)); width: var(--space-6); color: var(--color-muted); text-align: center; translate: 0 -50%; }
.flow__advisory { border-style: dashed !important; }
.flow__enforced { border-color: var(--color-accent) !important; box-shadow: inset 0 0 0 1px var(--color-accent); }

/* Figure 3: each level is one step higher than the one before. */
.ladder { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; gap: var(--space-2); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); }
.ladder > li { display: grid; gap: var(--space-1); align-content: start; padding: var(--space-3); border-top: 3px solid var(--color-accent); border-radius: var(--radius-control); background: var(--color-surface-raised); }
.ladder > li:nth-child(1) { min-height: 7rem; border-top-color: var(--color-border); }
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
.fg-site-steps { gap: var(--space-3); max-width: var(--measure); font-size: var(--text-md); }

/* Figure 3: the pillars grouped by job. */
.pillar-map { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: var(--space-4); margin: 0; padding: 0; list-style: none; }
.pillar-map > li { display: grid; gap: var(--space-2); align-content: start; }
.pillar-map ul { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.pillar-map a { display: grid; align-content: center; min-height: var(--control-lg); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); color: var(--color-text); font-size: var(--text-md); text-decoration: none; }
.pillar-map a:hover { border-color: var(--color-border); text-decoration: none; }
/* Figures 3 and 5: the pillar number is a tag, not a position. */
.pillar-tag { display: block; width: fit-content; margin-top: var(--space-1); color: var(--color-muted); font-size: var(--text-xs); }
a.pillar-tag:hover { color: var(--color-text); }

/* Figure 4: the fix order. */
.order { display: grid; gap: var(--space-2); font-size: var(--text-sm); }
.order > div { display: grid; gap: var(--space-2); }
.order > div + div { margin-top: var(--space-3); }
.order__chips { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.order__chip { display: block; padding: var(--space-2); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); line-height: var(--leading-tight); }
.order > div:first-child .order__chip { border-color: var(--color-accent); }
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
  .flow { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
  .flow > li + li::before { content: '↓'; top: calc(-1 * var(--space-5)); left: 50%; width: auto; height: var(--space-5); line-height: var(--space-5); translate: -50% 0; }
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
