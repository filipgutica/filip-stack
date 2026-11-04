<script setup lang="ts">
import { onMounted, ref } from "vue";
import { UiAlert, UiBadge, UiCodeBlock, UiTabs } from "@filipgutica/ui";
import type { Catalog } from "../../catalog";
import CatchFigure from "../lesson/CatchFigure.vue";
import LessonFigure from "../lesson/LessonFigure.vue";
import PillarSection from "../lesson/PillarSection.vue";
import ScorePips from "../lesson/ScorePips.vue";
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
  { id: "scoring", label: "Scoring a pillar" },
  { id: "audit-procedure", label: "Running an audit" },
  { id: "worked-example", label: "Worked example: this repository" },
  { id: "maintenance", label: "Keeping guidance current" },
];
const scorecard = [
  {
    pillar: "7 Bounded autonomy",
    gap: "The rule against AI attribution in commits was advisory only, and a reminder the harness injects every session contradicted it.",
    fix: "A hook that blocks attribution trailers, plus ask rules for merges and 1Password.",
    channel: "Enforced",
  },
  {
    pillar: "6 Reproducible environment",
    gap: "A fresh agent worktree could not install dependencies inside the agent's sandbox.",
    fix: "Share installed dependencies into worktrees or narrow the sandbox rule; put the fresh-worktree command in AGENTS.md; add a site preview per PR.",
    channel: "Enforced and advisory",
  },
  {
    pillar: "3 Test gates",
    gap: "No twenty-test sample, no single-test command in AGENTS.md, and the flake rate was unverified.",
    fix: "Run the sample; add node --test <file> to AGENTS.md.",
    channel: "Advisory",
  },
  {
    pillar: "2 Static gates",
    gap: "About 5,700 lines of root scripts and tests had no static check.",
    fix: "Add a type check or Fallow to pnpm check.",
    channel: "Enforced",
  },
  {
    pillar: "5 Review gates",
    gap: "No configuration showed a read-only, fresh-context reviewer running on pull requests.",
    fix: "Decide whether a reviewer triggered by risk is worth its cost.",
    channel: "Enforced",
  },
  {
    pillar: "1 Code shape",
    gap: "Boundary checks passed, but there was no duplication tool, so level 2 was not met.",
    fix: "Fallow, the same fix as pillar 2.",
    channel: "Enforced",
  },
  {
    pillar: "8 Guidance evaluated",
    gap: "The Workflow skills have baseline studies; the global guidance loaded on every task has none.",
    fix: "Run the decay test on the global guidance.",
    channel: "Advisory",
  },
  {
    pillar: "4 Documentation",
    gap: "Not every documented command was run, and the always-loaded global guidance was not decay-tested.",
    fix: "Prune it with the pillar 8 decay test.",
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
const modes = [
  { value: "new", label: "New project" },
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
      A coding agent stops when its work looks done. This lesson shows how to
      set up a repository so that looking done and being done are the same
      thing, and how to check whether yours is there yet.
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
        Ask a coding agent for a feature and it edits files, runs whatever it
        can, and tells you it is finished. It stops when the work
        <em>looks</em> done. It cannot judge
        anything it has no way to see.
      </p>
      <p>
        So whether “looks done” means “is done” depends on the environment
        around the agent. If the repository has a command that type-checks the
        code, the agent runs it and sees red. If tests cover the behavior, the
        agent sees the failure and fixes it. If it can start the app with
        realistic data, it can open the page and look.
      </p>
      <p>
        Take those away and the agent still stops when the work looks done.
        The difference is who finds the problem. Either the agent finds it a
        minute later, or you find it in review, and then you are acting as the
        agent's test suite. This lesson is about handing that job back to the environment.
      </p>
    </div>
    <LessonFigure :number="1">
      <CatchFigure />
      <template #caption>
        Who catches it? The same change, with and without four parts of an
        agent-ready environment. The scenario is illustrative.
      </template>
    </LessonFigure>
  </section>

  <section aria-labelledby="tell-check-bound">
    <h2 id="tell-check-bound">Three jobs: tell, check, bound</h2>
    <div class="prose">
      <p>
        Everything that makes an environment agent-ready does one of three
        jobs. Keep these in mind; every pillar later in the lesson is labelled
        with one.
      </p>
    </div>
    <dl class="jobs">
      <div>
        <dt>Tell</dt>
        <dd>
          Give the agent what it cannot see in the repository. For example,
          the command that runs every check, or why an old helper must not be
          copied.
        </dd>
      </div>
      <div>
        <dt>Check</dt>
        <dd>
          Return red or green on the work. For example, a type checker, a test,
          or a health check after setup.
        </dd>
      </div>
      <div>
        <dt>Bound</dt>
        <dd>
          Limit what the agent can touch, and name who signs off. For example,
          a deny rule on <code>.env</code> files, or a person who approves the
          merge.
        </dd>
      </div>
    </dl>
    <div class="prose">
      <p>
        In Figure 1, the check command, the tests, and the seeded app are
        checks, and the deny rule bounds. None of the four tells. Telling helps
        the agent aim, but on its own it gives the agent no way to see that it
        missed.
      </p>
    </div>
  </section>

  <section aria-labelledby="placement-advisory-or-enforced">
    <h2 id="placement-advisory-or-enforced">Advisory or enforced</h2>
    <div class="prose">
      <p>
        A rule reaches the agent on one of two channels. <strong>Advisory</strong> guidance is
        text the model reads: the prompt, <code>AGENTS.md</code> or
        <code>CLAUDE.md</code>, and skills. The model weighs it and may decide
        it does not apply. <strong>Enforced</strong> guidance is a mechanism:
        hooks, deny rules, the sandbox, the type checker, linters, and required
        CI checks. Each runs at an action boundary, such as a tool call, a
        commit, or a merge, whatever the model decided.
      </p>
    </div>
    <LessonFigure :number="2">
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
        Advisory guidance feeds the agent's decision, and the agent can set it
        aside. Enforced checks sit between the decision and the action, so
        they run either way.
      </template>
    </LessonFigure>
    <div class="prose">
      <p>Put each rule on the channel that matches its exceptions.</p>
      <ul>
        <li>
          A rule with no exceptions is enforced. OpenAI's
          <a :href="sources.harnessEngineering.href">harness engineering article</a>
          from early 2026 reports the same move: when documentation fell short,
          the rule became code. That article could not be fetched, so this
          lesson checked it only through secondary summaries.
        </li>
        <li>
          When an advisory line keeps getting missed, there are two possible
          causes. Either it is a rule that cannot
          bend, so it becomes a hook or a deny rule, or the file has grown long
          enough to bury it, so the file gets shorter. Adding emphasis fixes
          neither cause.
        </li>
        <li>
          A preference stays advisory. A large enforced set means preferences
          have leaked into it. Every hook fires wrongly sometimes, and someone
          has to maintain it.
        </li>
        <li>
          An enforced check should talk to the agent. An error message that
          states the fix lets the agent repair its own work. This also comes
          from the OpenAI article, and no current source confirms it yet.
        </li>
      </ul>
    </div>
  </section>

  <section aria-labelledby="durable-and-decaying-guidance">
    <h2 id="durable-and-decaying-guidance">Durable and decaying guidance</h2>
    <div class="prose">
      <p>
        Some guidance makes up for something the model cannot yet do well.
        Other guidance gives the model something it could never get by itself.
        Vendors now separate the two:
        <a :href="sources.claudeCodeBestPractices.href">Anthropic's Claude Code best practices</a>
        include a list called “What you can stop doing”. The first kind
        decays as models improve. The second kind lasts, so invest there.
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
        From that split, the skill makes an argument of its own; the vendors do
        not rank the pillars. As models read code better, the documentation an
        agent needs shrinks. No model improvement lets an agent observe an app
        it cannot start, or data that does not exist. So a reproducible
        environment is the most durable investment, followed by the static and
        test gates that make the work checkable.
      </p>
    </div>
  </section>

  <section aria-labelledby="the-pillars">
    <h2 id="the-pillars">The eight pillars</h2>
    <div class="prose">
      <p>
        The pillars split agent readiness into areas you can audit one at a
        time. Each has a job from the previous section, an audit check you can
        observe, and a reference file in the skill with its sources and
        anti-patterns. Pillars 7 and 8 extend the original six, from the same
        vendor guidance: the questions to ask before an unattended run and writing evaluations before guidance.
      </p>
    </div>
    <LessonFigure :number="3">
      <ul class="pillar-map">
        <li v-for="group in pillarMap" :key="group.job">
          <span class="lesson-label">{{ group.job }}</span>
          <ul>
            <li v-for="pillar in group.pillars" :key="pillar.number">
              <a :href="`#${pillar.reference.replace(/\.md$/, '')}`"
                ><span>{{ pillar.number }}</span> {{ pillar.title }}</a
              >
            </li>
          </ul>
        </li>
      </ul>
      <template #caption>
        The eight pillars, grouped by the job each one does. Select a pillar
        to jump to it.
      </template>
    </LessonFigure>

    <PillarSection
      v-bind="pillar(1)"
      :reference-base="referenceBase"
    >
      <p>
        Agents learn the conventions by reading the code, and they copy what
        they find, including patterns the team is moving away from. When there is one way to do each job,
        the nearest example is the right example.
      </p>
      <template #check>
        For three recent features, each decision they touch, such as a
        validation rule, a permission check, or a state transition, is made in
        one place. Duplication and boundary tools pass.
      </template>
      <template #good>
        <ul>
          <li>Each concept has one owning module. Others call it rather than reimplement it.</li>
          <li>Dependency direction is declared and enforced, for example with ESLint boundary rules, dependency-cruiser, or Fallow in TypeScript, import-linter in Python, <code>internal/</code> packages in Go, or ArchUnit on the JVM.</li>
          <li>Data enters at one validated boundary and flows one way through named layers.</li>
          <li>Legacy areas are marked “do not copy”, and a lint rule that bans the old import enforces it where possible.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(2)"
      :reference-base="referenceBase"
    >
      <p>
        A build exit code and a linter are checks the agent can run and read.
        The most useful line in an instruction file is the command that runs
        them, and a <code>Stop</code> hook turns running it from a request into
        a condition of finishing. Codex guidance
        likewise asks for a “done when” condition and the relevant lint,
        format, and type checks.
      </p>
      <template #check>
        One command runs every static gate locally, and CI runs the same
        command. Clean <code>main</code> is green, and suppressions are counted.
      </template>
      <template #good>
        <ul>
          <li>Strict typing: TypeScript <code>strict</code>, mypy or Pyright strict, <code>go vet</code> with staticcheck, Clippy with warnings denied.</li>
          <li>Lint, dead code and unused dependencies, complexity limits, and duplication checks.</li>
          <li>One <code>check</code> command runs locally and in CI with the same configuration, with a changed-files mode to keep it fast.</li>
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
        Tests are the main red-or-green check.
        Agents tend to call a feature complete after unit tests or a
        <code>curl</code> call, and they catch more bugs when they test end to
        end as a user would. The agent runs
        and trusts every test, so a test that cannot fail gives it a false
        green. The layering below is field practice, not vendor guidance.
      </p>
      <template #check>
        A single test file runs with one command. A sample of tests each maps
        to one contract and one credible regression.
      </template>
      <template #good>
        <ul>
          <li>Each layer owns a different risk: unit tests for pure logic, component tests for one unit's public contract, integration or contract tests for boundaries with real dependencies, and a few end-to-end user journeys.</li>
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
        Instruction files load into every session, so every line takes a
        little attention on every task. Aim for
        the smallest set of high-signal lines and load the rest when a task
        needs it. To decide whether a
        line earns its place, ask two questions:
      </p>
      <ol>
        <li>Could the agent find this by reading the code?</li>
        <li>Would it actually go and look?</li>
      </ol>
      <p>
        If both answers are yes, delete the line. Keep the verification
        commands anyway, because they are the most useful lines even though
        <code>package.json</code> holds them. Judge global behavior rules,
        which no repository can show, with the decay test instead.
      </p>
      <template #check>
        Every always-loaded line passes the two-question test or the decay
        test, and every documented command runs.
      </template>
      <template #good>
        <ul>
          <li>The always-loaded file holds the commands (install, single test, typecheck, lint, run the app), misleading places in the code, decisions the code does not show, and anything corrected twice.</li>
          <li>Repeated procedures live in skills, which load only when a task needs them.</li>
          <li>Decision records explain why. A glossary maps domain terms to code names where they differ.</li>
          <li>CI runs the documented commands and checks the links.</li>
          <li>No dated advice in the body. Version requirements that are still true stay.</li>
          <li>Layout is left out. <a :href="sources.claudeCodeBestPractices.href">Anthropic's best practices</a> list architecture and layout descriptions as outdated advice, while <a :href="sources.codexBestPractices.href">Codex best practices</a> allow layout in <code>AGENTS.md</code>. The skill sides with Anthropic because layout is the easiest thing to discover and the quickest to go stale; a short pointer to an unusual layout is fine.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(5)"
      :reference-base="referenceBase"
    >
      <p>
        A reviewer in a fresh context never saw the reasoning that produced
        the code, so it is not swayed by it, and read-only tools make sure it
        cannot edit. A reviewer asked to find
        problems always finds some. Fixing every finding adds layers and tests
        for impossible cases, so the review prompt should say what to skip.
      </p>
      <template #check>
        Each review angle has a trigger, runs read-only in a fresh context, and
        has its findings verified before anyone fixes them.
      </template>
      <template #good>
        <ul>
          <li>Leave anything a tool can check to a gate.</li>
          <li>Contract adherence, the diff against the spec or ticket, runs on every change.</li>
          <li>Other angles run when the diff carries their risk: simplicity and reuse for a new abstraction or dependency, test value when tests change, security for authentication, input, secrets, or permissions, performance for hot paths and unbounded loops, coding standards for rules no linter can express.</li>
          <li>The reviewer gets the spec and the diff, not the author's reasoning.</li>
          <li>Each finding is checked against the code before anyone fixes it, and a person approves the merge.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(6)"
      :reference-base="referenceBase"
    >
      <p>
        This is the most durable pillar. No model can observe an app it cannot
        start, or inspect states the data does not contain. A worktree is a
        fresh checkout with no installed dependencies, and installing by trial and error is slow
        and can fail outright. A failed setup step may not even stop the agent:
        <a :href="sources.copilotEnvironment.href">GitHub's Copilot documentation</a>
        says it carries on in a partial environment, which is why setup ends
        with a health check.
      </p>
      <template #check>
        A fresh worktree, inside the agent's own sandbox, reaches a seeded,
        healthy, running app with one command, and two worktrees run at once
        without collisions.
      </template>
      <template #good>
        <ul>
          <li>One command takes a clean checkout to a running, seeded app, in the agent's sandbox as well as on a workstation, with isolated ports, databases, and profiles per worktree.</li>
          <li>Cold setup (from nothing) and warm setup (dependencies already present) are both scripted, and setup ends with a health check that fails loudly.</li>
          <li>A deterministic seed, versioned with the schema, covers the states that matter: empty, error, large, each permission level, each locale. It contains no production personal data.</li>
          <li>The agent can observe the app: browser automation, logs, metrics, and traces from the command line.</li>
          <li>One teardown command, and a preview environment per pull request for human reviewers.</li>
          <li>The recipe lives in a script or a project skill, not a README paragraph.</li>
          <li>For a repository that ships guidance rather than an app, the environment is a throwaway host home where the guidance applies, plus a harness that runs agents against it.</li>
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
        runs have turn or spend caps and a human sign-off.
      </template>
      <template #good>
        <ul>
          <li>Deny rules for secrets and protected paths.</li>
          <li>Worktree or container isolation, and least-privilege tokens.</li>
          <li>Turn or spend caps on unattended runs.</li>
          <li>A person approves merges, deploys, and anything irreversible.</li>
        </ul>
      </template>
    </PillarSection>

    <PillarSection
      v-bind="pillar(8)"
      :reference-base="referenceBase"
    >
      <p>
        Measure the agent without the guidance first, write the minimum that
        closes the gaps you saw, and iterate against that baseline, as
        <a :href="sources.skillAuthoring.href">Anthropic's skill authoring guide</a>
        recommends. Test with every model the guidance
        targets, because what one model needs another finds redundant. Advice
        that made up for older models becomes overhead.
      </p>
      <template #check>
        Each instruction file or skill has evidence that it changes behavior
        against a no-guidance baseline.
      </template>
      <template #good>
        <ul>
          <li>Evaluations compare guidance with no guidance on matched tasks, model, and harness.</li>
          <li>Routing evaluations check that skill descriptions trigger when they should.</li>
          <li>A periodic pruning pass removes lines the current model already follows by default.</li>
        </ul>
      </template>
    </PillarSection>
  </section>

  <section aria-labelledby="scoring">
    <h2 id="scoring">Scoring a pillar</h2>
    <div class="prose">
      <p>
        Each pillar gets a score from 0 to 3. The rubric is the skill's own
        synthesis, not vendor guidance. Each level builds on the one below
        it.
      </p>
    </div>
    <LessonFigure :number="4">
      <ol class="ladder" aria-label="Score levels">
        <li>
          <span class="ladder__score">0</span>
          <strong>Absent</strong>
          <span>Missing, or no verified evidence.</span>
        </li>
        <li>
          <span class="ladder__score">1</span>
          <strong>Written down</strong>
          <span>A documented policy, script, or intent that nobody has shown runs.</span>
        </li>
        <li>
          <span class="ladder__score">2</span>
          <strong>Runnable</strong>
          <span>One command from a fresh checkout, with only declared prerequisites, and verified evidence that it works.</span>
        </li>
        <li>
          <span class="ladder__score">3</span>
          <strong>Enforced and measured</strong>
          <span>It blocks the action it guards, and its results are tracked over at least 20 runs or 30 days.</span>
        </li>
      </ol>
      <template #caption>
        The score ladder. A required check that blocks merge, or a hook that
        blocks a tool call, is enforced. Optional CI that fails loudly but does
        not block merge stays at level 2.
      </template>
    </LessonFigure>
    <div class="prose">
      <ul>
        <li>
          A pillar's score is the highest level whose criteria the verified
          evidence fully meets. An unverified check cannot lift a pillar; list
          it under Unverified instead.
        </li>
        <li>
          Mark a pillar N/A when it does not apply, give a one-line reason, and
          leave it out of the total. When it applies only in part, score the
          parts that apply and name the checks you dropped.
        </li>
      </ul>
      <p>Evidence has a strength, too. From strongest to weakest:</p>
    </div>
    <ol class="fg-site-steps">
      <li>A local run in a fresh checkout, inside the agent's sandbox. Record the sandbox configuration, so a failure can be traced to the repository or to the auditor's machine.</li>
      <li>CI results on the exact commit audited.</li>
      <li>CI results on current <code>main</code>, labelled as a different commit.</li>
      <li>Source inspection: the script exists and reads correctly. For anything runnable, this supports level 1 at most.</li>
    </ol>
    <div class="prose">
      <p>
        A failed fresh setup is scored once, in pillar 6. Other pillars can
        still reach level 2 on CI evidence, or on a local run with dependencies
        supplied another way, labelled as such. Required checks, branch rules,
        and review history need read access to the forge API, such as
        <code>gh api</code>; without it, mark them unverified.
      </p>
    </div>
  </section>

  <section aria-labelledby="audit-procedure">
    <h2 id="audit-procedure">Running an audit</h2>
    <div class="prose">
      <p>
        An audit has three modes. Pick every one that applies: a repository
        that ships guidance, like this one, needs both the existing-repository
        and the engineering-guidance modes.
      </p>
    </div>
    <UiTabs v-model="mode" :items="modes" label="Audit mode" class="modes">
      <template #panel="{ value }">
        <div v-if="value === 'new'" class="modes__panel">
            <p class="hint">Gates are cheapest to add at zero lines of code.</p>
            <ol class="fg-site-steps">
              <li>Pillar 6: one command for setup, run, and teardown, with a seed script and a health check, proven inside the agent's sandbox.</li>
              <li>Pillars 2 and 3: strict types, lint, dead-code and boundary tools, and a single-file test command, behind one <code>check</code> command that CI runs and requires.</li>
              <li>Pillar 7: deny rules and sandbox limits for every “never” rule.</li>
              <li>Pillar 4: a short <code>AGENTS.md</code> with those commands. Add a line only after you have corrected the agent twice.</li>
              <li>Pillars 1 and 5 grow with the code: record each decision when you make it, and add review angles as risk appears.</li>
            </ol>
        </div>
        <div v-else-if="value === 'existing'" class="modes__panel">
            <p class="hint">Measure what is there before you change anything.</p>
            <ol class="fg-site-steps">
              <li>Time a fresh worktree to a seeded, running app inside the agent's sandbox. Record cold and warm setup separately, with each manual step.</li>
              <li>Run every gate on clean <code>main</code>. Record duration and failures.</li>
              <li>Count suppressions by kind.</li>
              <li>Sample twenty tests and three recent features against pillars 1 and 3.</li>
              <li>Mine recent human review comments for repeats. Treat each repeat as a hypothesis (a missing rule, test, or decision, or a wrong review) and verify it.</li>
              <li>Score every pillar.</li>
            </ol>
        </div>
        <div v-else class="modes__panel">
            <p class="hint">Instruction files, skills, and review gates.</p>
            <ol class="fg-site-steps">
              <li>Measure what each host actually loads every session, not only file sizes. In Claude Code, <code>/context</code> shows it, as the <a :href="sources.claudeCodeBestPractices.href">Claude Code best practices</a> describe.</li>
              <li>Classify each instruction as durable or decaying, and as advisory or enforced.</li>
              <li>List every “always” or “never” rule that is only advisory. Each is a placement defect or a preference worded too strongly.</li>
              <li>Find lines that restate the layout, scripts, or config. Keep the verification commands.</li>
              <li>Find the same meaning stated in more than one file.</li>
              <li>Check that review gates triage findings and push back on over-fixing.</li>
              <li>Ask for evaluation evidence. A written policy with no results scores 1; no policy scores 0.</li>
            </ol>
        </div>
      </template>
    </UiTabs>
    <h3 id="report">The report</h3>
    <div class="prose">
      <p>
        Write an Evidence section, then one table row per pillar with its
        score, evidence, top gap, fix, and channel, then the places where the
        skill was hard to apply, then everything left unverified and what
        running it needs. The channel column describes the proposed fix, not
        the current state.
      </p>
      <p>
        Order the fixes by blast radius first: any unenforced pillar 7 rule
        about secrets, protected paths, or irreversible actions comes first,
        along with any defect that can hide such a rule from the agent, such as
        instructions cut off by a size limit. Then order by durability, then by
        cost.
      </p>
    </div>
    <LessonFigure :number="5">
      <div class="order">
        <p class="order__first">
          <span class="lesson-label">First, by blast radius</span>
          <span class="order__chip"
            ><span>7</span> {{ pillar(7).title }}</span
          >
        </p>
        <div>
          <span class="lesson-label">Then by durability</span>
          <ol class="order__chips">
            <li v-for="number in [6, 3, 2, 5, 1, 8, 4]" :key="number" class="order__chip">
              <span>{{ number }}</span> {{ pillar(number).title }}
            </li>
          </ol>
          <p class="order__scale" aria-hidden="true">
            <span>Most durable</span><span>Least durable</span>
          </p>
        </div>
      </div>
      <template #caption>
        The fix order. The durability ranking is the skill's argument from the
        durable and decaying split; vendors do not rank the pillars.
      </template>
    </LessonFigure>
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
        The most useful finding came first. A fresh
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
              <span>{{ row.pillar }}</span>
              <ScorePips :score="1" />
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
        An earlier draft scored 12 of 24 under a looser rubric. The drop came
        from tightening the rubric, not from any change in the repository.
      </p>
      <p>
        The audit also tested the skill. Five places where it was hard to apply
        went back into the skill: a repository can need both modes, pillar 6
        needed a meaning for guidance repositories, setup has to succeed inside
        the agent's sandbox, the two-question test covers only repository
        facts, and some checks need forge access.
      </p>
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
        The audit has not been run again, so these fixes are not reflected in
        a score yet.
      </p>
    </div>
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
      <dd>A new model follows some guidance by default, so a line becomes a no-op or does more harm than good.</dd>
    </dl>
    <div class="prose">
      <p>
        Vendors retire their own advice as models catch up. Guidance is guidance, so pillar 8 applies
        to it too: test it against the models it targets, and add instructions
        only where you have seen a failure.
      </p>
      <p>Review the guidance when any of these happens:</p>
      <ul>
        <li>A frontier model that your agents use is released. Read its migration guide or release notes.</li>
        <li>A source you cite, or a vendor changelog you watch, changes.</li>
        <li>An audit result is disputed, or a score does not match how agents actually perform in that repository.</li>
        <li>A quarter passes with no review.</li>
      </ul>
      <p>The review itself has seven steps:</p>
    </div>
    <ol class="fg-site-steps">
      <li>Fetch each source again and mark every cited claim confirmed, changed, or removed. A claim that only a source from before the current model generation supports is unconfirmed until a current source restates it or the decay test covers it.</li>
      <li>Record each new recommendation and harness mechanism, and decide where it goes.</li>
      <li>Walk the durable and decaying table and the placement rules again. Keep a line only if it still tells, checks, or bounds.</li>
      <li>Test for decay. Fix the protocol first: two reference repositories (one strong, one weak), a task set, attempts per arm, a pass criterion, and an approved budget. Run the guidance against no guidance, then remove one section at a time. Delete a section only when removing it makes no difference.</li>
      <li>Calibrate the rubric: reference scores should stay stable across models. A check that now passes everywhere no longer separates strong from weak.</li>
      <li>When vendors disagree, record both positions and how you reconcile them. Prefer current vendor documentation over dated posts, and never rely on a secondary summary alone.</li>
      <li>Edit the claims, refresh the verified dates, and commit with a message that names the trigger. Git history is the review log.</li>
    </ol>
    <div class="prose">
      <p>
        A scheduled agent can re-verify sources and collect new guidance every month and open a
        pull request with what it found. The rest needs judgment and a
        person's approval, and the decay test costs money because it runs paid
        evaluations.
      </p>
    </div>
  </section>

  <section aria-labelledby="next-steps">
    <h2 id="next-steps">Next steps</h2>
    <div class="prose">
      <p>
        The <code>agent-ready-environments</code> skill is this lesson written
        for an agent. Install it, then ask your agent to audit a repository for
        agent readiness. It picks the modes, collects evidence, and writes the
        report described above.
      </p>
    </div>
    <UiCodeBlock
      :code="install"
      language="bash"
      variant="compact"
      :copyable="enhanced"
      :wrap="true"
    />
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
        <p>Triggers and the review steps above, in full.</p>
      </li>
    </ul>
  </section>

  <section aria-labelledby="further-reading">
    <h2 id="further-reading">Further reading</h2>
    <div class="prose">
      <p>
        The vendor guidance behind the skill, last checked on 2026-11-01. The
        0–3 rubric, the fix order, and the durability ranking are the skill's
        own synthesis.
      </p>
    </div>
    <ul class="further-reading">
      <li v-for="source in sources" :key="source.href">
        <a :href="source.href">{{ source.title }}</a>
        <span v-if="'note' in source" class="further-reading__note">{{ source.note }}</span>
      </li>
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
.fg-site-steps { gap: var(--space-3); max-width: var(--measure); font-size: var(--text-md); }

/* Figure 3: the pillars grouped by job. */
.pillar-map { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: var(--space-4); margin: 0; padding: 0; list-style: none; }
.pillar-map > li { display: grid; gap: var(--space-2); align-content: start; }
.pillar-map ul { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.pillar-map a { display: flex; align-items: center; gap: var(--space-3); min-height: var(--control-lg); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); color: var(--color-text); font-size: var(--text-md); text-decoration: none; }
.pillar-map a:hover { border-color: var(--color-border); text-decoration: none; }
.pillar-map a span { display: grid; flex: none; width: var(--space-6); height: var(--space-6); place-items: center; border-radius: var(--radius-pill); background: var(--color-surface-muted); color: var(--color-muted); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }

/* Figure 4: the fix order. */
.order { display: grid; gap: var(--space-5); font-size: var(--text-sm); }
.order__first { display: grid; justify-items: start; gap: var(--space-2); }
.order > div { display: grid; gap: var(--space-2); }
.order__chips { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.order__chip { display: block; padding: var(--space-2); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface-raised); line-height: var(--leading-tight); }
.order__first .order__chip { border-color: var(--color-accent); }
.order__chip > span { display: block; font-size: var(--text-lg); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; }
.order__scale { display: flex; justify-content: space-between; padding-top: var(--space-1); border-top: 1px solid var(--color-border-subtle); color: var(--color-muted); font-size: var(--text-xs); }

.lesson-table { max-width: 100%; overflow-x: auto; font-size: var(--text-md); }
.lesson-table table { width: 100%; border-collapse: collapse; }
.lesson-table th { padding: 0 var(--space-4) var(--space-2) 0; color: var(--color-muted); font-size: var(--text-sm); font-weight: var(--weight-medium); text-align: start; vertical-align: top; }
.lesson-table td, .lesson-table tbody th, .lesson-table tfoot th { padding: var(--space-3) var(--space-4) var(--space-3) 0; border-top: 1px solid var(--color-border-subtle); color: var(--color-text); font-size: var(--text-md); vertical-align: top; }
.lesson-table tbody tr:last-child > * { border-bottom: 1px solid var(--color-border-subtle); }
.scorecard tbody th { width: 13rem; font-weight: var(--weight-medium); }
.scorecard tbody th > span:first-child { display: block; margin-bottom: var(--space-1); }
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
